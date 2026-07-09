'use client'

import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import {
  type LossClaim,
  type BattlefieldData,
} from '@/lib/business-types'
import { getBusinessService, type LossProofFile } from '@/lib/services'
import { getTelegramInitData } from '@/lib/tg'
import { apiRequest, isApiAdapterEnabled } from '@/lib/api-client'

export type Stage = 'splash' | 'gate' | 'scar' | 'app'
export type Tab = 'home' | 'sale' | 'profile'
export type Role = 'gambler' | 'believer' | null

type AppState = {
  stage: Stage
  tab: Tab
  role: Role
  lossClaim: LossClaim
  lossAmount: number
  isTrial: boolean
  battlefieldData: BattlefieldData | null
  battlefieldLoading: boolean
  setStage: (s: Stage) => void
  setTab: (t: Tab) => void
  setRole: (r: Role) => void
  confirmLoss: (amount: number) => void
  submitLossProof: (file: LossProofFile) => Promise<LossClaim>
  startTrial: () => void
  exitTrial: () => void
  refreshBattlefield: () => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

const defaultLossClaim: LossClaim = {
  status: 'not_submitted',
  amountUsd: null,
  certificateNo: null,
  message: '尚未提交亏损截图。',
  source: 'demo',
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const businessService = useMemo(() => getBusinessService(), [])
  const [stage, setStage] = useState<Stage>('app')
  const [tab, setTab] = useState<Tab>('home')
  const [role, setRole] = useState<Role>(null)
  const [lossClaim, setLossClaim] = useState<LossClaim>(defaultLossClaim)
  const [isTrial, setIsTrial] = useState(false)
  const [battlefieldData, setBattlefieldData] = useState<BattlefieldData | null>(null)
  const [battlefieldLoading, setBattlefieldLoading] = useState(false)

  const lossAmount = lossClaim.amountUsd ?? 0

  const refreshBattlefield = useCallback(async () => {
    setBattlefieldLoading(true)
    try {
      const res = await fetch('/api/battlefield/data', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json() as BattlefieldData
        setBattlefieldData(data)
      }
    } catch (e) {
      console.error('Failed to fetch battlefield data:', e)
    } finally {
      setBattlefieldLoading(false)
    }
  }, [])

  const confirmLoss = useCallback((amount: number) => {
    setLossClaim({
      status: 'verified',
      amountUsd: amount,
      certificateNo: null,
      message: '后端审核已确认亏损金额。',
      source: 'api',
    })
  }, [])

  const submitLossProof = useCallback(
    async (file: LossProofFile) => {
      const claim = await businessService.submitLossProof(file)
      setLossClaim(claim)
      return claim
    },
    [businessService],
  )

  const startTrial = useCallback(() => {
    const trial = businessService.getTrialSession()
    setIsTrial(true)
    setRole('gambler')
    setLossClaim(trial.lossClaim)
    setStage('app')
    setTab('home')
  }, [businessService])

  const exitTrial = useCallback(() => {
    setIsTrial(false)
    setRole(null)
    setLossClaim(defaultLossClaim)
    setStage('app')
    setTab('home')
  }, [])

  // Load session from API on mount
  useEffect(() => {
    if (isApiAdapterEnabled()) {
      const loadApiData = async () => {
        try {
          const initData = getTelegramInitData()
          if (initData) {
            await apiRequest('/api/auth/telegram', {
              method: 'POST',
              body: { initData },
            })
          }

          interface SessionResponse {
            lossClaim: LossClaim
            lockedGBalance: number
            streakDays: number
            diaoPriceUsd: number
            diaoHighestPriceUsd: number
          }
          const resSession = await apiRequest<SessionResponse>('/api/me/session')
          if (resSession.ok) {
            const claim = resSession.data.lossClaim
            setLossClaim(claim)
            if (claim.status !== 'not_submitted') {
              setRole('gambler')
            }
          }
          setStage('app')
          setTab('home')

          // Fetch battlefield data
          await refreshBattlefield()
        } catch (e) {
          console.error('API backend load error:', e)
          setStage('app')
          setTab('home')
        }
      }
      loadApiData()
    } else {
      Promise.resolve().then(() => setStage('app'))
    }
  }, [businessService, refreshBattlefield])

  // Refresh battlefield every 30s
  useEffect(() => {
    if (stage !== 'app') return
    const interval = setInterval(refreshBattlefield, 30_000)
    return () => clearInterval(interval)
  }, [stage, refreshBattlefield])

  const value = useMemo(
    () => ({
      stage, tab, role, lossClaim, lossAmount, isTrial,
      battlefieldData, battlefieldLoading,
      setStage, setTab, setRole, confirmLoss, submitLossProof,
      startTrial, exitTrial, refreshBattlefield,
    }),
    [stage, tab, role, lossClaim, lossAmount, isTrial,
      battlefieldData, battlefieldLoading,
      setStage, setTab, setRole, confirmLoss, submitLossProof,
      startTrial, exitTrial, refreshBattlefield],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
