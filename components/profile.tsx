'use client'

import { useState } from 'react'
import { Wallet, Unplug, Shield, Coins, Share2, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useTonConnectUI, useTonWallet, useTonAddress } from '@tonconnect/ui-react'
import { useApp } from '@/lib/app-context'
import { getTGUsername } from '@/lib/tg'
import { ClaimDiao } from '@/components/claim-diao'
import { ShareBattleCard } from '@/components/share-battle-card'

export function Profile() {
  const { lossClaim, battlefieldData, isTrial } = useApp()
  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet()
  const walletAddress = useTonAddress(false)
  const [username] = useState(() => getTGUsername())

  const [platform, setPlatform] = useState('x')
  const [taskUrl, setTaskUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ status: string; reason: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleTaskSubmit = async () => {
    if (!taskUrl) {
      setErrorMsg('请输入分享链接。')
      return
    }
    if (!taskUrl.toLowerCase().startsWith('https://')) {
      setErrorMsg('链接必须以 https:// 开头。')
      return
    }
    setErrorMsg('')
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/social-tasks/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          taskType: 'share_diao',
          url: taskUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || '提交失败')
      } else {
        setResult({
          status: data.submission.status === 'pending_review' && data.submission.aiSuggestedStatus === 'ai_passed' ? 'ai_passed' : data.submission.status,
          reason: data.submission.reason,
        })
        setTaskUrl('')
      }
    } catch {
      setErrorMsg('网络请求出错，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  const d = battlefieldData
  const lossUsd = d?.lossUsd ?? 0
  const flipTarget = d?.flipTargetUsd ?? 0
  const requiredDiao = d?.requiredDiaoAtRound18 ?? 0
  const purchasedPackages = d?.purchasedPackages ?? 0
  const diaoBalance = d?.diaoBalance ?? 0
  const holdingValue = d?.holdingValueUsd ?? 0
  const currentRound = d?.currentRound ?? 0
  const progressPercent = d?.progressPercent ?? 0
  const hasLoss = lossClaim.status === 'verified' && lossUsd > 0
  const hasPurchase = purchasedPackages > 0

  return (
    <div className="page-fade flex flex-col gap-6 px-5 pb-28 pt-5">
      {/* Identity */}
      <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex size-14 items-center justify-center rounded-full border-2 border-primary bg-primary/15 text-lg font-bold text-primary shadow-[0_0_16px_oklch(0.74_0.17_55/40%)]">
          我
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold font-mono">{username}</span>
            {isTrial && (
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">试玩</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {hasPurchase ? `已购 ${purchasedPackages} 份 DIAO` : '尚未购买 DIAO'}
          </span>
        </div>
      </section>

      {/* Wallet Status */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-bold">钱包状态</h2>
        </div>
        {wallet ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-success animate-pulse" />
              <span className="font-mono text-xs text-foreground">
                {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : '已连接'}
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

      {/* Loss & Target */}
      <section className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">亏损金额</span>
          <span className="font-mono text-xl font-bold text-destructive">
            {hasLoss ? `-$${lossUsd.toLocaleString()}` : '待审核'}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">翻身目标</span>
          <span className="font-mono text-xl font-bold text-primary">
            {hasLoss ? `$${flipTarget.toLocaleString()}` : '-'}
          </span>
        </div>
      </section>

      {hasLoss && (
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">所需 DIAO（第18轮 $2.62144）</span>
          <span className="font-mono text-xl font-bold text-foreground">{requiredDiao.toLocaleString()}</span>
        </div>
      )}

      {/* Purchase Summary */}
      {hasPurchase && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Coins className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-bold">我的资产</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5 rounded-2xl bg-secondary/40 p-3">
              <span className="text-[10px] text-muted-foreground">购买份数</span>
              <span className="font-mono text-sm font-bold">{purchasedPackages}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-2xl bg-secondary/40 p-3">
              <span className="text-[10px] text-muted-foreground">DIAO 持仓</span>
              <span className="font-mono text-sm font-bold">{diaoBalance.toLocaleString()}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-2xl bg-secondary/40 p-3">
              <span className="text-[10px] text-muted-foreground">持仓价值</span>
              <span className="font-mono text-sm font-bold text-success">${Math.round(holdingValue).toLocaleString()}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-2xl bg-secondary/40 p-3">
              <span className="text-[10px] text-muted-foreground">翻身进度</span>
              <span className="font-mono text-sm font-bold text-primary">{progressPercent.toFixed(1)}%</span>
            </div>
          </div>
        </section>
      )}

      {/* Claim Status */}
      {hasPurchase && (
        <ClaimDiao
          currentRound={currentRound}
          purchasedPackages={purchasedPackages}
          highestClaimedRound={d?.highestClaimedRound ?? 0}
        />
      )}

      {/* Share */}
      {hasLoss && hasPurchase && (
        <ShareBattleCard
          lossUsd={lossUsd}
          flipTargetUsd={flipTarget}
          requiredDiao={requiredDiao}
          progressPercent={progressPercent}
        />
      )}

      {/* Social Task Submission */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Share2 className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-bold">推广任务验证</h2>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-muted-foreground">平台</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary/20 p-2 text-xs text-foreground focus:outline-none focus:border-primary"
          >
            <option value="x">X / Twitter</option>
            <option value="telegram">Telegram</option>
            <option value="binance_square">币安广场</option>
            <option value="okx_planet">OKX 星球</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] text-muted-foreground">链接地址</label>
          <input
            type="text"
            placeholder="https://..."
            value={taskUrl}
            onChange={(e) => setTaskUrl(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary/20 p-2 text-xs text-foreground focus:outline-none focus:border-primary"
          />
        </div>

        {errorMsg && (
          <div className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {result && (
          <div className="rounded-xl bg-secondary/30 p-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              {result.status === 'ai_passed' && (
                <>
                  <CheckCircle2 className="size-4 text-success" />
                  <span className="text-success">AI 预审通过 (ai_passed)</span>
                </>
              )}
              {result.status === 'verified' && (
                <>
                  <CheckCircle2 className="size-4 text-success" />
                  <span className="text-success">审核通过 (verified)</span>
                </>
              )}
              {result.status === 'rejected' && (
                <>
                  <XCircle className="size-4 text-destructive" />
                  <span className="text-destructive">已被拒绝 (rejected)</span>
                </>
              )}
              {result.status === 'pending_review' && (
                <>
                  <AlertCircle className="size-4 text-warning" />
                  <span className="text-warning">人工审核中 (pending_review)</span>
                </>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{result.reason}</p>
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={handleTaskSubmit}
          className="w-full rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              正在验证...
            </>
          ) : (
            '提交推广链接'
          )}
        </button>
      </section>

      {/* Security note */}
      <section className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <Shield className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          所有交易通过 TonConnect 在你的钱包中签名确认，平台不持有任何私钥或资产。
        </p>
      </section>
    </div>
  )
}
