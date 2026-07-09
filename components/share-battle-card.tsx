'use client'

import { useState } from 'react'
import { Share2, MessageCircle, X, Sparkles, Orbit } from 'lucide-react'
import { SHARE_PLATFORMS, shareToPlatform, type SharePlatform } from '@/lib/share'
import { DIAO_TOKENOMICS } from '@/lib/ton-config'
import type { ComponentType } from 'react'

type ShareBattleCardProps = {
  lossUsd: number
  flipTargetUsd: number
  requiredDiao: number
  progressPercent: number
}

const iconByPlatform: Record<SharePlatform, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  telegram: MessageCircle,
  x: X,
  binance_square: Sparkles,
  okx_planet: Orbit,
}

export function ShareBattleCard({ lossUsd, flipTargetUsd, requiredDiao, progressPercent }: ShareBattleCardProps) {
  const [notice, setNotice] = useState<string | null>(null)

  const shareText = `我在合约里亏了 $${lossUsd.toLocaleString()}，翻身目标 $${flipTargetUsd.toLocaleString()}。需要 ${requiredDiao.toLocaleString()} DIAO，第18轮目标价 $${DIAO_TOKENOMICS.round18PriceUsd}。当前距离翻身 ${progressPercent.toFixed(1)}%。赌狗也有春天，来一起翻身！`

  function handleShare(platform: SharePlatform) {
    const opened = shareToPlatform(platform, shareText)
    setNotice(opened ? '已打开分享页面' : '暂时无法打开该平台')
  }

  if (lossUsd <= 0) return null

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-card p-4">
      <div className="flex items-center gap-2">
        <Share2 className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-bold">分享战绩卡</h2>
      </div>

      {/* Visual Card */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 text-center">
        <p className="text-[10px] tracking-widest text-muted-foreground">DAWN IS ALWAYS OURS · DIAO</p>
        <p className="font-mono text-3xl font-bold text-destructive">-${lossUsd.toLocaleString()}</p>
        <div className="grid grid-cols-2 gap-2 text-left">
          <div className="rounded-xl bg-secondary/40 px-2.5 py-1.5">
            <p className="text-[9px] text-muted-foreground">翻身目标</p>
            <p className="font-mono text-xs font-bold text-primary">${flipTargetUsd.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-secondary/40 px-2.5 py-1.5">
            <p className="text-[9px] text-muted-foreground">所需 DIAO</p>
            <p className="font-mono text-xs font-bold text-foreground">{requiredDiao.toLocaleString()}</p>
          </div>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="shimmer absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-700"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
        <p className="font-mono text-sm font-bold text-foreground">距离翻身 {progressPercent.toFixed(1)}%</p>
        <p className="text-[9px] text-muted-foreground">第 18 轮目标价 <span className="font-mono font-bold text-primary">${DIAO_TOKENOMICS.round18PriceUsd}</span></p>
      </div>

      {/* Share Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {SHARE_PLATFORMS.map((platform) => {
          const Icon = iconByPlatform[platform.id]
          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => handleShare(platform.id)}
              className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-secondary px-2 py-2 text-[11px] font-bold text-primary transition-all active:scale-95"
            >
              <Icon className="size-3.5" aria-hidden />
              <span className="truncate">{platform.label}</span>
            </button>
          )
        })}
      </div>

      {notice && <p className="text-center text-[10px] text-muted-foreground" aria-live="polite">{notice}</p>}
    </section>
  )
}
