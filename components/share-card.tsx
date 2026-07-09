'use client'

import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import { MessageCircle, Orbit, Send, Sparkles, X } from 'lucide-react'
import { SHARE_PLATFORMS, getPlatformUnavailableMessage, shareToPlatform, type SharePlatform } from '@/lib/share'

type ShareCardProps = {
  title: string
  description?: string
  text: string
  platforms?: SharePlatform[]
  compact?: boolean
}

const iconByPlatform: Record<SharePlatform, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  telegram: MessageCircle,
  x: X,
  binance_square: Sparkles,
  okx_planet: Orbit,
}

export function ShareCard({ title, description, text, platforms, compact = false }: ShareCardProps) {
  const [notice, setNotice] = useState<string | null>(null)
  const selectedPlatforms = useMemo(
    () => SHARE_PLATFORMS.filter((platform) => !platforms || platforms.includes(platform.id)),
    [platforms],
  )

  function handleShare(platform: SharePlatform, label: string) {
    const opened = shareToPlatform(platform, text)
    setNotice(opened ? `已尝试打开 ${label}，请在外部页面确认发布。` : getPlatformUnavailableMessage(platform))
  }

  return (
    <section className={`flex flex-col gap-2 rounded-2xl border border-border bg-card ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center gap-2">
        <Send className="size-3.5 text-primary" aria-hidden />
        <h2 className="text-xs font-bold text-foreground">{title}</h2>
      </div>
      {description && <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>}
      <div className="grid grid-cols-2 gap-2">
        {selectedPlatforms.map((platform) => {
          const Icon = iconByPlatform[platform.id]
          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => handleShare(platform.id, platform.label)}
              className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-secondary px-2 py-2 text-[11px] font-bold text-primary transition-all active:scale-95"
            >
              <Icon className="size-3.5" aria-hidden />
              <span className="truncate">{platform.label}</span>
            </button>
          )
        })}
      </div>
      {notice && <p className="text-[10px] leading-relaxed text-muted-foreground" aria-live="polite">{notice}</p>}
    </section>
  )
}
