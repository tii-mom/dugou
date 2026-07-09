'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle2, XCircle, Coins, Lock } from 'lucide-react'
import { useTonConnectUI, useTonAddress } from '@tonconnect/ui-react'
import { DIAO_TOKENOMICS } from '@/lib/ton-config'
import { type TxStatus } from '@/lib/business-types'
import { useApp } from '@/lib/app-context'

type ClaimDiaoProps = {
  currentRound: number
  purchasedPackages: number
  highestClaimedRound: number
  compact?: boolean
}

export function ClaimDiao({ currentRound, purchasedPackages, highestClaimedRound, compact = false }: ClaimDiaoProps) {
  const [tonConnectUI] = useTonConnectUI()
  const walletAddress = useTonAddress(false)
  const { refreshBattlefield } = useApp()

  const [txStatus, setTxStatus] = useState<TxStatus>('idle')
  const [notice, setNotice] = useState<string | null>(null)

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const claimable = Math.max(0, (currentRound - highestClaimedRound) * purchasedPackages * DIAO_TOKENOMICS.releasePerRound)
  const claimed = highestClaimedRound * purchasedPackages * DIAO_TOKENOMICS.releasePerRound
  const nextUnlockPrice = Number((DIAO_TOKENOMICS.initialPriceUsd * Math.pow(2, currentRound + 1)).toFixed(5))

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  async function handleClaim() {
    if (claimable <= 0) return
    setTxStatus('pending_sign')
    setNotice(null)
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)

    try {
      // 1. Create Claim Intent on Server
      const intentRes = await fetch('/api/claims/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
        credentials: 'include',
      })

      if (!intentRes.ok) {
        const errJson = await intentRes.json() as { error?: string }
        throw new Error(errJson.error || '创建领取意向失败')
      }

      const { claim, txParams } = await intentRes.json() as {
        claim: { claimId: string; status: string }
        txParams: { to: string; value: string; payload: string }
      }

      // 2. Open Wallet for Signing
      const result = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
          address: txParams.to,
          amount: txParams.value,
          payload: txParams.payload,
        }],
      })

      setTxStatus('broadcasted')
      setNotice('领取交易已在钱包签名广播，正在同步状态...')

      // 3. Inform Backend of Broadcasted BOC
      const broadcastRes = await fetch('/api/claims/broadcasted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: claim.claimId,
          tx_boc: result.boc,
        }),
        credentials: 'include',
      })

      if (!broadcastRes.ok) {
        const errJson = await broadcastRes.json() as { error?: string }
        throw new Error(errJson.error || '同步广播状态失败')
      }

      setTxStatus('confirming')
      setNotice('链上确认中，请稍候...')

      // 4. Poll for claim confirm
      let attempts = 0
      const maxAttempts = 40 // ~2 mins

      pollIntervalRef.current = setInterval(async () => {
        attempts++
        if (attempts > maxAttempts) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
          setTxStatus('failed')
          setNotice('核验超时：领取交易确认耗时较长，请稍后刷新战场状态。')
          return
        }

        try {
          const confirmRes = await fetch(`/api/claims/confirm?claimId=${claim.claimId}`, {
            credentials: 'include',
          })
          if (confirmRes.ok) {
            const data = await confirmRes.json() as { status: string; claim?: unknown; error?: string; message?: string }
            if (data.status === 'confirmed') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
              setTxStatus('confirmed')
              setNotice('领取成功！链上已核准，本地账本已刷新。')
              refreshBattlefield()
            } else if (data.status === 'failed') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
              setTxStatus('failed')
              setNotice(data.message || '领取核验失败。')
            }
          }
        } catch (e) {
          console.error('Polling claim confirmation error:', e)
        }
      }, 3000)

    } catch (e) {
      setTxStatus('failed')
      setNotice(e instanceof Error ? e.message : '领取操作失败')
    }
  }

  if (purchasedPackages <= 0) return null

  return (
    <section className={`flex flex-col gap-3 rounded-2xl border border-border bg-card ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center gap-2">
        <Coins className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-bold">我的领取</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5 rounded-xl bg-secondary/40 p-2.5">
          <span className="text-[10px] text-muted-foreground">可领取</span>
          <span className="font-mono text-sm font-bold text-success">{claimable.toLocaleString()} DIAO</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl bg-secondary/40 p-2.5">
          <span className="text-[10px] text-muted-foreground">已领取</span>
          <span className="font-mono text-sm font-bold text-foreground">{claimed.toLocaleString()} DIAO</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>已解锁至第 <span className="font-mono font-bold text-foreground">{currentRound}</span> 轮</span>
        <span className="flex items-center gap-1">
          <Lock className="size-3" />
          下一轮价 <span className="font-mono font-bold text-primary">${nextUnlockPrice}</span>
        </span>
      </div>

      {claimable > 0 ? (
        <button
          type="button"
          onClick={handleClaim}
          disabled={txStatus === 'pending_sign' || txStatus === 'broadcasted' || txStatus === 'confirming'}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-success text-success-foreground text-sm font-bold transition-all active:scale-[0.99] disabled:opacity-60"
        >
          {(txStatus === 'pending_sign' || txStatus === 'broadcasted' || txStatus === 'confirming') && (
            <Loader2 className="size-4 animate-spin" />
          )}
          {txStatus === 'pending_sign'
            ? '请在钱包中确认...'
            : txStatus === 'broadcasted' || txStatus === 'confirming'
            ? '链上核验中...'
            : `领取 ${claimable.toLocaleString()} DIAO`}
        </button>
      ) : (
        <div className="rounded-xl bg-secondary/30 px-3 py-2.5 text-center text-xs text-muted-foreground">
          暂无可领取，下一轮解锁价 <span className="font-mono font-bold text-primary">${nextUnlockPrice}</span>
        </div>
      )}

      {notice && (
        <div className={`flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed border ${
          txStatus === 'confirmed'
            ? 'border-success/35 bg-success/10 text-success'
            : txStatus === 'failed'
            ? 'border-destructive/35 bg-destructive/10 text-destructive'
            : 'border-primary/35 bg-primary/10 text-primary'
        }`}>
          {txStatus === 'confirming' ? (
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
          ) : txStatus === 'confirmed' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0" />
          )}
          <span>{notice}</span>
        </div>
      )}
    </section>
  )
}
