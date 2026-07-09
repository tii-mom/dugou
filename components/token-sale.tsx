'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { Coins, Loader2, CheckCircle2, XCircle, Wallet, Unplug, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { useTonConnectUI, useTonWallet, useTonAddress } from '@tonconnect/ui-react'
import { DIAO_TOKENOMICS } from '@/lib/ton-config'
import {
  calculateTokenSaleIntent,
  DIAO_SALE_PACKAGE,
  DIAO_UNLOCK_ROUNDS,
  DIAO_INITIAL_PRICE_USD,
  formatDIAO,
} from '@/lib/token-sale'
import { useApp } from '@/lib/app-context'
import { type TxStatus } from '@/lib/business-types'

export function TokenSale() {
  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet()
  const walletAddress = useTonAddress(false)
  const { battlefieldData, refreshBattlefield } = useApp()

  const [packages, setPackages] = useState(1)
  const [txStatus, setTxStatus] = useState<TxStatus>('idle')
  const [notice, setNotice] = useState<string | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const totals = useMemo(() => calculateTokenSaleIntent(packages), [packages])
  const totalDiao = totals.immediateDIAO + totals.lockedDIAO
  const flipTarget = battlefieldData?.flipTargetUsd ?? 0
  const coveragePercent = flipTarget > 0 ? (totalDiao * DIAO_TOKENOMICS.round18PriceUsd / flipTarget * 100) : 0

  const visibleRounds = [...DIAO_UNLOCK_ROUNDS.slice(0, 6), ...DIAO_UNLOCK_ROUNDS.slice(-2)]

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  async function handleBuy() {
    if (!wallet) {
      tonConnectUI.openModal()
      return
    }
    setTxStatus('pending_sign')
    setNotice(null)
    setPurchaseSuccess(false)
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)

    try {
      // 1. Create Purchase Intent on Server
      const intentRes = await fetch('/api/token-sale/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, packages }),
        credentials: 'include',
      })

      if (!intentRes.ok) {
        const errJson = await intentRes.json() as { error?: string }
        throw new Error(errJson.error || '创建认购意向失败')
      }

      const { intent, txParams } = await intentRes.json() as {
        intent: { intentId: string; status: string }
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
      setNotice('交易已在钱包签名广播，正在向后端同步状态...')

      // 3. Inform Backend of Broadcasted boc
      const broadcastRes = await fetch('/api/purchases/broadcasted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: intent.intentId,
          tx_boc: result.boc,
        }),
        credentials: 'include',
      })

      if (!broadcastRes.ok) {
        const errJson = await broadcastRes.json() as { error?: string }
        throw new Error(errJson.error || '同步广播状态失败')
      }

      setTxStatus('confirming')
      setNotice('链上交易确认中，请稍候...')

      // 4. Start Polling for chain verification
      let attempts = 0
      const maxAttempts = 40 // ~2 mins

      pollIntervalRef.current = setInterval(async () => {
        attempts++
        if (attempts > maxAttempts) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
          setTxStatus('failed')
          setNotice('核验超时：链上交易确认耗时过长。请稍后刷新“我的”页面确认入账状态。')
          return
        }

        try {
          const confirmRes = await fetch(`/api/purchases/confirm?intentId=${intent.intentId}`, {
            credentials: 'include',
          })
          if (confirmRes.ok) {
            const data = await confirmRes.json() as { status: string; purchase?: unknown; error?: string; message?: string }
            if (data.status === 'confirmed') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
              setTxStatus('confirmed')
              setNotice(`购买成功！${formatDIAO(totals.immediateDIAO)} 已到账，${formatDIAO(totals.lockedDIAO)} 进入锁仓。`)
              setPurchaseSuccess(true)
              refreshBattlefield()
            } else if (data.status === 'failed') {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
              setTxStatus('failed')
              setNotice(data.message || '链上核验失败。')
            }
          }
        } catch (e) {
          console.error('Polling confirmation error:', e)
        }
      }, 3000)

    } catch (e) {
      setTxStatus('failed')
      setNotice(e instanceof Error ? e.message : '购买流执行失败')
    }
  }

  const buyButtonDisabled = txStatus === 'pending_sign' || txStatus === 'broadcasted' || txStatus === 'confirming'
  const buyButtonText = !wallet
    ? '连接钱包'
    : txStatus === 'pending_sign'
    ? '请在钱包中确认...'
    : txStatus === 'broadcasted' || txStatus === 'confirming'
    ? '链上确认中...'
    : `购买 ${packages} 份 · 支付 ${totals.contractRequiredTon} TON`

  return (
    <div className="page-fade flex flex-col gap-6 px-5 pb-28 pt-5">
      {/* Header */}
      <section className="evidence-card flex flex-col gap-4 rounded-3xl border border-primary/25 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-primary">官方代币销售</span>
            <h1 className="text-2xl font-black tracking-normal">赌狗翻身仗</h1>
            <p className="text-xs leading-relaxed text-muted-foreground">
              58 TON 一份，每钱包最多 10 份，全局最多 2,000 份。购买后立即获得 200,000 DIAO，3,000,000 DIAO 进入锁仓分 15 轮释放。
            </p>
          </div>
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <Coins className="size-6 text-primary" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* Wallet Connection */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-bold">钱包连接</h2>
        </div>
        {wallet ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-success animate-pulse" />
              <span className="font-mono text-xs text-foreground">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '已连接'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => tonConnectUI.disconnect()}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Unplug className="size-3" />
              断开
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => tonConnectUI.openModal()}
            className="w-full rounded-xl border border-primary/30 bg-primary/10 py-3 text-sm font-bold text-primary transition-all active:scale-[0.99]"
          >
            连接 TON 钱包
          </button>
        )}
      </section>

      {/* Package Selection & Purchase */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-bold">选择购买份数</h2>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">购买份数：{packages} / {DIAO_SALE_PACKAGE.maxPackagesPerWallet}</span>
          <input
            type="range"
            min={1}
            max={DIAO_SALE_PACKAGE.maxPackagesPerWallet}
            step={1}
            value={packages}
            onChange={(e) => setPackages(Number(e.target.value))}
            className="accent-primary"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <SummaryTile label="需支付" value={`${totals.contractRequiredTon} TON`} />
          <SummaryTile label="立即到账" value={formatDIAO(totals.immediateDIAO)} />
          <SummaryTile label="锁仓额度" value={formatDIAO(totals.lockedDIAO)} />
          <SummaryTile label="每轮释放" value={formatDIAO(totals.perRoundDIAO)} />
          <SummaryTile label="总 DIAO" value={formatDIAO(totalDiao)} highlight />
          {flipTarget > 0 && (
            <SummaryTile label="翻身覆盖率" value={`${coveragePercent.toFixed(1)}%`} highlight />
          )}
        </div>

        {/* Buy Button */}
        <button
          type="button"
          onClick={handleBuy}
          disabled={buyButtonDisabled}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {(txStatus === 'pending_sign' || txStatus === 'broadcasted' || txStatus === 'confirming') && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          {buyButtonText}
        </button>

        {/* Tx Status */}
        {txStatus === 'confirmed' && notice && (
          <div className="flex items-start gap-2 rounded-xl border border-success/35 bg-success/10 p-3 text-xs leading-relaxed text-success">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {txStatus === 'failed' && notice && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {(txStatus === 'broadcasted' || txStatus === 'confirming') && notice && (
          <div className="flex items-start gap-2 rounded-xl border border-primary/35 bg-primary/10 p-3 text-xs leading-relaxed text-primary">
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
            <span>{notice}</span>
          </div>
        )}
      </section>

      {/* Post-purchase details */}
      {purchaseSuccess && battlefieldData && (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-center">
          <p className="text-xs font-bold text-primary">🎉 认购成功！</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            距离翻身 {battlefieldData.progressPercent.toFixed(1)}% · 目标 ${battlefieldData.flipTargetUsd.toLocaleString()}
          </p>
        </div>
      )}

      {/* Unlock Rules (collapsible) */}
      <button
        type="button"
        onClick={() => setShowRules(!showRules)}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
      >
        {showRules ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {showRules ? '收起解锁规则' : '查看解锁规则'}
      </button>

      {showRules && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold">解锁规则</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            初始价格 ${DIAO_INITIAL_PRICE_USD.toFixed(5)}。每当价格较上一轮翻倍，释放 5 亿 DIAO；第 1-15 轮面向购买参与者释放，第 16-18 轮进入团队钱包。
          </p>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[0.7fr_1.1fr_1fr_1.1fr] bg-secondary/60 px-3 py-2 text-[10px] font-bold text-muted-foreground">
              <span>轮次</span>
              <span>价格</span>
              <span>涨幅</span>
              <span>流向</span>
            </div>
            {visibleRounds.map((round, index) => (
              <div
                key={round.round}
                className={`grid grid-cols-[0.7fr_1.1fr_1fr_1.1fr] px-3 py-2 font-mono text-[10px] ${
                  index !== visibleRounds.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <span>第{round.round}轮</span>
                <span>${round.unlockPriceUsd.toFixed(5)}</span>
                <span>{round.multipleFromInitial.toLocaleString()}x</span>
                <span>{round.destination === 'participants' ? '参与者' : '团队'}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SummaryTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex min-h-20 flex-col justify-center gap-1 rounded-2xl bg-secondary/45 p-3">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm font-bold leading-tight ${highlight ? 'text-primary' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}
