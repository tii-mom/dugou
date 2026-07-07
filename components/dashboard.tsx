'use client'

import { useState } from 'react'
import { Flame, History, Zap } from 'lucide-react'
import { useApp, type DepositResult } from '@/lib/app-context'
import { useCountUp } from '@/lib/use-count-up'
import { Ticker } from '@/components/ticker'
import { UnlockCelebration } from '@/components/unlock-celebration'

const MARKS = [0.25, 0.5, 0.75]

export function Dashboard() {
  const { lossAmount, holdingsValue, dBalance, streak, critChance, deposit, unlocked } = useApp()
  const [result, setResult] = useState<DepositResult | null>(null)
  const [depositing, setDepositing] = useState(false)
  const [particles, setParticles] = useState<number[]>([])
  const [celebrated, setCelebrated] = useState(false)
  const [history, setHistory] = useState<DepositResult[]>([])

  const progress = Math.min(holdingsValue / lossAmount, 1)
  const remaining = Math.max(lossAmount - holdingsValue, 0)

  const animatedPercent = useCountUp(progress * 100)
  const animatedHoldings = useCountUp(holdingsValue)
  const animatedBalance = useCountUp(dBalance)

  function onDeposit() {
    if (depositing) return
    setDepositing(true)
    setResult(null)
    setTimeout(() => {
      const r = deposit(50)
      setResult(r)
      setHistory((h) => [r, ...h].slice(0, 3))
      setParticles(Array.from({ length: r.crit ? 26 : 14 }, (_, i) => i))
      setDepositing(false)
      setTimeout(() => setParticles([]), 1500)
    }, 1200)
  }

  if (unlocked && !celebrated) {
    return <UnlockCelebration onDone={() => setCelebrated(true)} />
  }

  return (
    <div className="page-fade flex flex-col gap-6 px-5 pb-28 pt-5">
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
            <span className="font-mono text-lg font-bold text-success">
              ${Math.round(animatedHoldings).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 容器 */}
        <div className="relative h-64 w-28 overflow-hidden rounded-full border border-border bg-secondary/60">
          {/* 警戒红线 */}
          <div className="absolute left-0 top-3 z-10 flex w-full items-center gap-1 px-1" aria-hidden="true">
            <div className="h-0.5 flex-1 bg-destructive shadow-[0_0_8px_oklch(0.6_0.22_25/80%)]" />
          </div>
          {/* 刻度线 25 / 50 / 75 */}
          {MARKS.map((m) => (
            <div
              key={m}
              aria-hidden="true"
              className="absolute left-0 z-10 flex w-full items-center gap-1 px-2"
              style={{ bottom: `${m * 92}%` }}
            >
              <div className={`h-px flex-1 ${progress >= m ? 'bg-success-foreground/30' : 'bg-border'}`} />
              <span className={`font-mono text-[8px] ${progress >= m ? 'text-success-foreground/60' : 'text-muted-foreground/60'}`}>
                {m * 100}
              </span>
            </div>
          ))}
          {/* 液面 */}
          <div
            className="liquid-surface shimmer absolute bottom-0 left-0 w-full rounded-b-full bg-success/80 transition-all duration-1000"
            style={{
              height: `${Math.max(progress * 92, 4)}%`,
              boxShadow: '0 -6px 24px oklch(0.75 0.16 155 / 55%)',
            }}
          />
          {/* 粒子 */}
          {particles.map((p) => (
            <span
              key={p}
              className={`particle ${result?.crit ? 'bg-primary' : 'bg-success'}`}
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

        <p className="font-mono text-3xl font-bold text-foreground">{animatedPercent.toFixed(1)}%</p>
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-muted-foreground">
            持有 <span className="font-mono font-bold text-foreground">{Math.round(animatedBalance).toLocaleString()}</span> 枚 D
          </p>
          <p className="text-xs text-muted-foreground">
            距离春天还差 <span className="font-mono font-bold text-primary">${Math.ceil(remaining).toLocaleString()}</span>
          </p>
        </div>
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
            result.crit ? 'border-primary bg-primary/15 legendary-glow' : 'border-success/40 bg-success/10'
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
        <Flame className={`size-9 ${depositing ? 'animate-bounce' : ''}`} aria-hidden="true" />
        <span className="text-base font-bold">{depositing ? '开箱中…' : '每日存入'}</span>
        <span className="font-mono text-xs opacity-80">50 USDT</span>
      </button>
      <p className="text-center text-xs text-muted-foreground">
        实际获得 D 数量在基础产出 80%–150% 间浮动，极低概率触发 5–10 倍暴击
      </p>

      {/* 近期开箱记录 */}
      {history.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4" aria-label="近期开箱记录">
          <div className="flex items-center gap-2">
            <History className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xs font-bold text-muted-foreground">近期开箱</h2>
          </div>
          <ul className="flex flex-col gap-1.5">
            {history.map((h, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className={h.crit ? 'font-bold text-primary' : 'text-muted-foreground'}>
                  {h.crit ? `暴击 x${h.multiplier.toFixed(1)}` : `x${h.multiplier.toFixed(2)}`}
                </span>
                <span className={`font-mono font-bold ${h.crit ? 'text-primary' : 'text-success'}`}>
                  +{h.gained.toLocaleString()} D
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
