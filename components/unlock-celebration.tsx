'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/app-context'
import { getTGUsername } from '@/lib/tg'
import { ArrowRight } from 'lucide-react'
import { ShareCard } from '@/components/share-card'

const TITLE = '春天，到了'
const SPARKS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: (i * 29) % 100,
  size: 4 + (i % 6),
  duration: 1.2 + (i % 5) * 0.25,
  delay: (i % 6) * 0.25,
}))

export function UnlockCelebration({ onDone }: { onDone: () => void }) {
  const { lossClaim, lossAmount, battlefieldData, isTrial } = useApp()
  const holdingsValue = battlefieldData?.holdingValueUsd ?? 0
  const [phase, setPhase] = useState<'dawn' | 'title' | 'cert'>('dawn')
  const [username] = useState(() => getTGUsername())

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('title'), 700)
    const t2 = setTimeout(() => setPhase('cert'), 2600)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 px-6 ${phase === 'dawn' ? 'dawn-shake bg-foreground' : 'bg-background'}`}
      style={
        phase !== 'dawn'
          ? { background: 'linear-gradient(180deg, oklch(0.13 0.01 270) 0%, oklch(0.2 0.05 55) 100%)' }
          : undefined
      }
    >
      {/* 升起的光斑 */}
      {phase !== 'dawn' &&
        SPARKS.map((spark) => (
          <span
            key={spark.id}
            className="particle bg-success"
            style={{
              left: `${spark.left}%`,
              width: `${spark.size}px`,
              height: `${spark.size}px`,
              animationDuration: `${spark.duration}s`,
              animationIterationCount: 'infinite',
              animationDelay: `${spark.delay}s`,
            }}
            aria-hidden="true"
          />
        ))}

      {phase !== 'dawn' && (
        <h2 className="text-5xl font-bold text-foreground">
          {TITLE.split('').map((ch, i) => (
            <span key={i} className="char-pop" style={{ animationDelay: `${0.2 + i * 0.25}s` }}>
              {ch}
            </span>
          ))}
        </h2>
      )}

      {phase === 'cert' && (
        <div className="evidence-card rise-in flex w-full max-w-sm flex-col gap-5 rounded-3xl p-8 text-center border-2 border-primary/80 shadow-[0_0_24px_oklch(0.74_0.17_55/40%)]">
          <p className="font-mono text-xs tracking-[0.35em] text-primary">SPRING CERTIFICATE · DEMO</p>

          {/* 用户姓名铭牌 */}
          <div className="flex items-center justify-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 border border-primary/30 w-fit mx-auto">
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold text-primary font-mono">{username}</span>
          </div>

          <div className="flex items-center justify-between gap-4 mt-2">
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-muted-foreground">最初的记录</span>
              <span className="font-mono text-lg font-bold text-destructive line-through">
                {lossClaim.status === 'demo_estimate' ? `-$${lossAmount.toLocaleString()} demo` : `-$${lossAmount.toLocaleString()}`}
              </span>
            </div>
            <ArrowRight className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-muted-foreground">如今的解锁</span>
              <span className="font-mono text-lg font-bold text-success">
                +${Math.round(holdingsValue).toLocaleString()}
              </span>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">当前为前端演示证书；真实解锁以后端审核和结算为准。</p>

          <div className="flex flex-col gap-2.5 mt-2">
            <ShareCard
              title="晒出高光证书"
              description="真实证书和结算以后端审核为准。"
              text={`【春天，到了】我完成了一次${isTrial ? '演示' : '待确认'}解锁流程：目标 $${lossAmount.toLocaleString()}，持仓展示 $${Math.round(holdingsValue).toLocaleString()}。`}
              compact
            />

            <button
              type="button"
              onClick={onDone}
              className="rounded-xl border border-border bg-secondary py-3 text-sm font-bold text-foreground transition-all active:scale-95"
            >
              收下证书，继续前进
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
