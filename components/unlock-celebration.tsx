'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/app-context'

const TITLE = '春天，到了'

export function UnlockCelebration({ onDone }: { onDone: () => void }) {
  const { lossAmount, holdingsValue } = useApp()
  const [phase, setPhase] = useState<'dawn' | 'title' | 'cert'>('dawn')

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
        Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            className="particle bg-success"
            style={{
              left: `${Math.random() * 100}%`,
              width: `${4 + Math.random() * 6}px`,
              height: `${4 + Math.random() * 6}px`,
              animationDuration: `${1.2 + Math.random() * 1.5}s`,
              animationIterationCount: 'infinite',
              animationDelay: `${Math.random() * 1.5}s`,
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
        <div className="evidence-card rise-in flex w-full max-w-sm flex-col gap-5 rounded-3xl p-8 text-center">
          <p className="font-mono text-xs tracking-[0.35em] text-primary">SPRING CERTIFICATE</p>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-muted-foreground">最初的阵亡</span>
              <span className="font-mono text-xl font-bold text-destructive line-through">
                -${lossAmount.toLocaleString()}
              </span>
            </div>
            <span className="text-muted-foreground" aria-hidden="true">
              {'->'}
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-muted-foreground">如今的解锁</span>
              <span className="font-mono text-xl font-bold text-success">+${Math.round(holdingsValue).toLocaleString()}</span>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">你从深渊里，把自己捞了上来。</p>
          <button
            type="button"
            onClick={onDone}
            className="rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
          >
            收下证书，继续前进
          </button>
        </div>
      )}
    </div>
  )
}
