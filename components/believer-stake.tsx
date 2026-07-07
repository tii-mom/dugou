'use client'

import { useState } from 'react'
import { Leaf, Star } from 'lucide-react'
import { useApp } from '@/lib/app-context'

const teams = [
  { id: 't1', name: '回本敢死队', members: 6, progress: 0.54 },
  { id: 't2', name: '凌晨三点俱乐部', members: 9, progress: 0.38 },
  { id: 't3', name: '不再梭哈联盟', members: 4, progress: 0.71 },
]

const amounts = [50, 100, 500]

export function BelieverStake() {
  const { setStage } = useApp()
  const [amount, setAmount] = useState(100)
  const [teamId, setTeamId] = useState<string | null>('t1')

  return (
    <main className="flex min-h-dvh flex-col gap-8 px-6 pb-10 pt-16">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-success">
          <Leaf className="size-5" aria-hidden="true" />
          <p className="font-mono text-xs tracking-[0.3em]">KEEPER MODE</p>
        </div>
        <h1 className="text-2xl font-bold">为幸存者点亮一盏灯</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          质押 D 代币或稳定币，积累护林值与光合积累，静静守望一支狗队。
        </p>
      </header>

      <section className="evidence-card flex flex-col gap-4 rounded-3xl p-6">
        <h2 className="text-sm font-bold">选择质押额度</h2>
        <div className="flex gap-3">
          {amounts.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(a)}
              className={`flex-1 rounded-xl border py-4 font-mono text-lg font-bold transition-all active:scale-95 ${
                amount === a
                  ? 'border-success bg-success/15 text-success shadow-[0_0_12px_oklch(0.75_0.16_155/25%)]'
                  : 'border-border bg-card text-muted-foreground'
              }`}
            >
              {a} U
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
          <span className="text-xs text-muted-foreground">预计每日光合积累</span>
          <span key={amount} className="num-pop font-mono text-sm font-bold text-success">
            +{Math.round(amount * 0.8)} 护林值
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold">定向守望一支狗队（可选）</h2>
        {teams.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTeamId(t.id === teamId ? null : t.id)}
            className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-colors ${
              teamId === t.id ? 'border-success/60 bg-success/10' : 'border-border bg-card'
            }`}
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold">{t.name}</span>
              <span className="text-xs text-muted-foreground">{t.members} 名成员 · 集体进度 {Math.round(t.progress * 100)}%</span>
            </div>
            {teamId === t.id && <Star className="size-4 fill-success text-success" aria-hidden="true" />}
          </button>
        ))}
        <p className="text-xs leading-relaxed text-muted-foreground">
          守望后，你的头像将以小巧星标出现在该队伍成员环绕列表的外圈。
        </p>
      </section>

      <button
        type="button"
        onClick={() => setStage('app')}
        className="breathe mt-auto w-full rounded-2xl bg-success py-4 text-base font-bold text-success-foreground"
      >
        点亮这盏灯
      </button>
    </main>
  )
}
