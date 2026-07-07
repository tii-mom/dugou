'use client'

import { useState } from 'react'
import { Flame, Zap } from 'lucide-react'
import { useApp, type DepositResult } from '@/lib/app-context'
import { Ticker } from '@/components/ticker'
import { UnlockCelebration } from '@/components/unlock-celebration'

export function Dashboard() {
  const { lossAmount, holdingsValue, dBalance, streak, critChance, deposit, unlocked } = useApp()
  const [result, setResult] = useState<DepositResult | null>(null)
  const [depositing, setDepositing] = useState(false)
  const [particles, setParticles] = useState<number[]>([])
  const [celebrated, setCelebrated] = useState(false)

  const progress = Math.min(holdingsValue / lossAmount, 1)

  function onDeposit() {
    if (depositing) return
    setDepositing(true)
    setResult(null)
    setTimeout(() => {
      const r = deposit(50)
      setResult(r)
      setParticles(Array.from({ length: 14 }, (_, i) => i))
      setDepositing(false)
      setTimeout(() => setParticles([]), 1500)
    }, 1200)
  }

  if (unlocked && !celebrated) {
    return <UnlockCelebration onDone={() => setCelebrated(true)} />
  }

  return (
    <div className="flex flex-col gap-6 px-5 pb-28 pt-5">
      <Ticker />

      {/* 战场沙盘：温度计容器 */}
      <section className="evidence-card relative flex flex-col items-center gap-4 rounded-3xl p-6" aria-label="春天进度">
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">春天目标</span>
            <span className="font-mono text-lg font-bold text-destructive">${lossAmount.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground">当前 D 持仓市值</span>
            <span className="font-mono text-lg font-bold text-success">${Math.round(holdingsValue).toLocaleString()}</span>
          </div>
        </div>

        {/* 容器 */}
        <div className="relative h-64 w-28 overflow-hidden rounded-full border border-border bg-secondary/60">
          {/* 警戒红线 */}
          <div className="absolute left-0 top-3 z-10 flex w-full items-center gap-1 px-1" aria-hidden="true">
            <div className="h-0.5 flex-1 bg-destructive shadow-[0_0_8px_oklch(0.6_0.22_25/80%)]" />
          </div>
          {/* 液面 */}
          <div
            className="liquid-surface absolute bottom-0 left-0 w-full rounded-b-full bg-success/80 transition-all duration-1000"
            style={{
              height: `${Math.max(progress * 92, 4)}%`,
              boxShadow: '0 -6px 24px oklch(0.75 0.16 155 / 55%)',
            }}
          />
          {/* 粒子 */}
          {particles.map((p) => (
            <span
              key={p}
              className="particle bg-success"
              style={{
                left: `${10 + Math.random() * 80}%`,
                width: `${3 + Math.random() * 5}px`,
                height: `${3 + Math.random() * 5}px`,
                animationDelay: `${Math.random() * 0.4}s`,
              }}
              aria-hidden="true"
            />
          ))}
        </div>

        <p className="font-mono text-3xl font-bold text-foreground">{Math.round(progress * 100)}%</p>
        <p className="text-xs text-muted-foreground">
          持有 <span className="font-mono font-bold text-foreground">{dBalance.toLocaleString()}</span> 枚 D
        </p>
      </section>

      {/* 连胜状态 */}
      <section className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Flame className="size-4 text-primary" aria-hidden="true" />
          <span className="text-sm">
            连胜 <span className="font-mono font-bold text-primary">{streak}</span> 天
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="size-4 text-primary" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">
            暴击概率 <span className="font-mono font-bold text-primary">{(critChance * 100).toFixed(1)}%</span>
          </span>
        </div>
      </section>

      {/* 开箱结果 */}
      {result && (
        <section
          className={`crit-burst flex flex-col items-center gap-2 rounded-2xl border p-5 text-center ${
            result.crit ? 'border-primary bg-primary/15' : 'border-success/40 bg-success/10'
          }`}
          aria-live="polite"
        >
          {result.crit ? (
            <>
              <p className="text-sm font-bold tracking-widest text-primary">暴击！！{result.multiplier.toFixed(1)} 倍产出</p>
              <p className="font-mono text-4xl font-bold text-primary">+{result.gained.toLocaleString()} D</p>
              <p className="text-xs text-muted-foreground">今天是被命运眷顾的一天</p>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">本次产出 {result.multiplier.toFixed(2)} 倍</p>
              <p className="font-mono text-3xl font-bold text-success">+{result.gained.toLocaleString()} D</p>
            </>
          )}
        </section>
      )}

      {/* 篝火存入按钮 */}
      <button
        type="button"
        onClick={onDeposit}
        disabled={depositing}
        className="fire-glow mx-auto flex size-40 flex-col items-center justify-center gap-1 rounded-full border-2 border-primary/60 bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-80"
      >
        <Flame className="size-9" aria-hidden="true" />
        <span className="text-base font-bold">{depositing ? '开箱中…' : '每日存入'}</span>
        <span className="font-mono text-xs opacity-80">50 USDT</span>
      </button>
      <p className="text-center text-xs text-muted-foreground">
        实际获得 D 数量在基础产出 80%–150% 间浮动，极低概率触发 5–10 倍暴击
      </p>
    </div>
  )
}
