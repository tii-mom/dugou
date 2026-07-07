'use client'

import { useEffect, useState } from 'react'
import { Award, Dices, Hourglass, Lock, Medal, TrendingDown, Trophy } from 'lucide-react'
import { badges, lossLeaderboard, speedLeaderboard } from '@/lib/mock-data'

const rarityStyle: Record<string, string> = {
  普通: 'border-border text-muted-foreground',
  稀有: 'border-success/60 text-success',
  传说: 'border-primary/70 text-primary',
}

const wheelPrizes = ['+88 D', '连胜保护卡', '+12 D', '稀有头像框', '+520 D', '再接再厉']

function useCountdown() {
  const [seconds, setSeconds] = useState(71 * 3600 + 42 * 60 + 18)
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(s - 1, 0)), 1000)
    return () => clearInterval(t)
  }, [])
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function Honor() {
  const [board, setBoard] = useState<'loss' | 'speed'>('loss')
  const [spinning, setSpinning] = useState(false)
  const [prize, setPrize] = useState<string | null>(null)
  const [flashIdx, setFlashIdx] = useState(0)
  const countdown = useCountdown()

  useEffect(() => {
    if (!spinning) return
    const t = setInterval(() => setFlashIdx((i) => (i + 1) % wheelPrizes.length), 120)
    return () => clearInterval(t)
  }, [spinning])

  function spin() {
    if (spinning || prize) return
    setSpinning(true)
    setTimeout(() => {
      setPrize(wheelPrizes[Math.floor(Math.random() * wheelPrizes.length)])
      setSpinning(false)
    }, 1600)
  }

  return (
    <div className="page-fade flex flex-col gap-6 px-5 pb-28 pt-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">荣誉室</h1>
        <p className="text-xs text-muted-foreground">S1 赛季 · 「首季幸存者」限定勋章开放中</p>
      </header>

      {/* 赛季冲刺 */}
      <section className="flex items-center justify-between rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Hourglass className="size-4 text-destructive" aria-hidden="true" />
          <span className="text-sm font-bold">最后 72 小时冲刺</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-lg font-bold text-destructive">{countdown}</span>
          <span className="text-[10px] text-primary">双倍开箱概率已开启</span>
        </div>
      </section>

      {/* 勋章陈列 */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Medal className="size-4 text-primary" aria-hidden="true" />
          勋章陈列
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {badges.map((b) => (
            <div
              key={b.name}
              className={`flex flex-col gap-2 rounded-2xl border bg-card p-4 ${rarityStyle[b.rarity]} ${
                b.owned ? (b.rarity === '传说' ? 'legendary-glow' : '') : 'opacity-50'
              }`}
            >
              <div className="flex items-center justify-between">
                {b.owned ? <Award className="size-5" aria-hidden="true" /> : <Lock className="size-5" aria-hidden="true" />}
                <span className="rounded-full border border-current px-2 py-0.5 text-[10px]">{b.rarity}</span>
              </div>
              <span className="text-sm font-bold text-foreground">{b.name}</span>
              <span className="text-[10px] leading-relaxed text-muted-foreground">{b.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 排行榜 */}
      <section className="flex flex-col gap-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setBoard('loss')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold ${
              board === 'loss' ? 'border-destructive/60 bg-destructive/10 text-destructive' : 'border-border bg-card text-muted-foreground'
            }`}
          >
            <TrendingDown className="size-3.5" aria-hidden="true" />
            亏损惨烈榜
          </button>
          <button
            type="button"
            onClick={() => setBoard('speed')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold ${
              board === 'speed' ? 'border-success/60 bg-success/10 text-success' : 'border-border bg-card text-muted-foreground'
            }`}
          >
            <Trophy className="size-3.5" aria-hidden="true" />
            回本速度榜
          </button>
        </div>
        <ol className="flex flex-col gap-2">
          {(board === 'loss' ? lossLeaderboard : speedLeaderboard).map((row) => (
            <li key={row.rank} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`font-mono text-sm font-bold ${row.rank <= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                  #{row.rank}
                </span>
                <span className="text-sm">{row.name}</span>
              </div>
              {'amount' in row ? (
                <span className="font-mono text-sm font-bold text-destructive">-${row.amount.toLocaleString()}</span>
              ) : (
                <span className="font-mono text-sm font-bold text-success">{row.days} 天回本</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* 命运转盘 */}
      <section className="evidence-card flex flex-col items-center gap-4 rounded-3xl p-6 text-center">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Dices className={`size-4 text-primary ${spinning ? 'wheel-spin' : ''}`} aria-hidden="true" />
          命运转盘 · 每日免费一次
        </h2>
        {spinning ? (
          <div className="flex h-8 items-center gap-2 overflow-hidden font-mono text-sm text-foreground" aria-hidden="true">
            <span>{wheelPrizes[flashIdx]}</span>
          </div>
        ) : prize ? (
          <p className="crit-burst font-mono text-2xl font-bold text-primary" aria-live="polite">
            {prize}
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            今天没存款也没关系，完成分享或邀请任务即可换取一次免费转盘机会。
          </p>
        )}
        <button
          type="button"
          onClick={spin}
          disabled={spinning || !!prize}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {spinning ? '命运旋转中…' : prize ? '今日机会已用完' : '转一次'}
        </button>
      </section>
    </div>
  )
}
