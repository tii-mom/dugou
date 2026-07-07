'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type Stage = 'splash' | 'gate' | 'scar' | 'stake' | 'app'
export type Tab = 'home' | 'den' | 'honor' | 'profile'
export type Role = 'gambler' | 'believer' | null

export type DepositResult = {
  base: number
  gained: number
  multiplier: number
  crit: boolean
}

type AppState = {
  stage: Stage
  tab: Tab
  role: Role
  lossAmount: number
  targetAmount: number
  holdingsValue: number
  dBalance: number
  streak: number
  critChance: number
  unlocked: boolean
  setStage: (s: Stage) => void
  setTab: (t: Tab) => void
  setRole: (r: Role) => void
  confirmLoss: (amount: number) => void
  deposit: (usdt: number) => DepositResult
}

const AppContext = createContext<AppState | null>(null)

const D_PRICE = 0.042 // 每枚 D 的模拟市价（USDT）

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [stage, setStage] = useState<Stage>('splash')
  const [tab, setTab] = useState<Tab>('home')
  const [role, setRole] = useState<Role>(null)
  const [lossAmount, setLossAmount] = useState(8361)
  const [dBalance, setDBalance] = useState(31450)
  const [streak, setStreak] = useState(6)

  const targetAmount = lossAmount
  const holdingsValue = dBalance * D_PRICE
  const critChance = Math.min(0.02 + streak * 0.005, 0.08)
  const unlocked = holdingsValue >= targetAmount

  const confirmLoss = useCallback((amount: number) => {
    setLossAmount(amount)
  }, [])

  const deposit = useCallback(
    (usdt: number): DepositResult => {
      const base = Math.round(usdt / D_PRICE)
      const crit = Math.random() < critChance
      const multiplier = crit ? 5 + Math.random() * 5 : 0.8 + Math.random() * 0.7
      const gained = Math.round(base * multiplier)
      setDBalance((b) => b + gained)
      setStreak((s) => s + 1)
      return { base, gained, multiplier, crit }
    },
    [critChance],
  )

  const value = useMemo(
    () => ({
      stage,
      tab,
      role,
      lossAmount,
      targetAmount,
      holdingsValue,
      dBalance,
      streak,
      critChance,
      unlocked,
      setStage,
      setTab,
      setRole,
      confirmLoss,
      deposit,
    }),
    [stage, tab, role, lossAmount, targetAmount, holdingsValue, dBalance, streak, critChance, unlocked, confirmLoss, deposit],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export const D_TOKEN_PRICE = D_PRICE
