'use client'

import { Flame, Sprout } from 'lucide-react'
import { useApp } from '@/lib/app-context'

export function Gate() {
  const { setStage, setRole } = useApp()

  function chooseGambler() {
    setRole('gambler')
    setStage('scar')
  }

  function chooseBeliever() {
    setRole('believer')
    setStage('stake')
  }

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-6 pb-10 pt-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-balance text-2xl font-bold">两扇门，一个春天</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">选择你的入场方式。亏损证明者，才是这个世界的主角。</p>
      </header>

      <div className="flex flex-1 flex-col gap-5">
        {/* 左门：亏损者 */}
        <button
          type="button"
          onClick={chooseGambler}
          className="rise-in group relative flex flex-1 flex-col justify-end overflow-hidden rounded-3xl border-2 border-destructive/50 bg-card p-6 text-left transition-transform active:scale-[0.98]"
          style={{ animationDelay: '0.1s' }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-25"
            style={{
              background:
                'radial-gradient(ellipse at 50% 110%, oklch(0.6 0.22 25 / 60%) 0%, transparent 65%), repeating-linear-gradient(115deg, transparent 0 40px, oklch(0.6 0.22 25 / 18%) 40px 41px)',
            }}
          />
          <div className="relative flex flex-col gap-3">
            <span className="flex size-12 items-center justify-center rounded-full border border-destructive/60 bg-destructive/15 text-destructive">
              <Flame className="size-6" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-bold text-foreground">我曾亏得体无完肤，我要进春天</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">持有真实合约亏损证明 · 上传伤疤 · 获得狗爹/狗仔正式身份</p>
            <span className="font-mono text-xs tracking-widest text-destructive">SCARRED ENTRY -&gt;</span>
          </div>
        </button>

        {/* 右门：信徒 */}
        <button
          type="button"
          onClick={chooseBeliever}
          className="rise-in group relative flex flex-1 flex-col justify-end overflow-hidden rounded-3xl border border-success/40 bg-card p-6 text-left transition-transform active:scale-[0.98]"
          style={{ animationDelay: '0.25s' }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-20"
            style={{
              background:
                'radial-gradient(ellipse at 50% 110%, oklch(0.75 0.16 155 / 50%) 0%, transparent 65%), repeating-linear-gradient(65deg, transparent 0 50px, oklch(0.75 0.16 155 / 14%) 50px 51px)',
            }}
          />
          <div className="relative flex flex-col gap-3">
            <span className="flex size-12 items-center justify-center rounded-full border border-success/50 bg-success/10 text-success">
              <Sprout className="size-6" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-bold text-foreground">我想为幸存者点亮一盏灯</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">无需亏损证明 · 积累护林值 · 以信徒身份守望某支狗队</p>
            <span className="font-mono text-xs tracking-widest text-success">KEEPER ENTRY -&gt;</span>
          </div>
        </button>
      </div>
    </main>
  )
}
