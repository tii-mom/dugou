'use client'

import { useState } from 'react'
import { useApp } from '@/lib/app-context'
import { Ticker } from '@/components/ticker'

export function Splash() {
  const { setStage } = useApp()
  const [verifying, setVerifying] = useState(false)

  function enter() {
    setVerifying(true)
    // 静默身份验证 + 钱包创建（模拟）
    setTimeout(() => setStage('gate'), 1400)
  }

  return (
    <main className="relative flex min-h-dvh flex-col justify-between overflow-hidden px-6 pb-10 pt-24">
      <div className="flex flex-1 flex-col justify-center gap-6">
        <p className="font-mono text-xs tracking-[0.4em] text-primary">DUGOU SPRING · D</p>
        <h1 data-text="别怕，这里的人比你更惨" className="glitch text-balance text-4xl font-bold leading-tight text-foreground">
          别怕，这里的人比你更惨
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          赌狗也有春天。凌晨三点还在盯盘的人，都值得一次体面的回本。
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <Ticker />
        <button
          type="button"
          onClick={enter}
          disabled={verifying}
          className="breathe w-full rounded-2xl bg-primary py-5 text-lg font-bold text-primary-foreground transition-opacity disabled:opacity-70"
        >
          {verifying ? '正在确认身份…' : '确认身份，进入春天'}
        </button>
        <p className="text-center text-xs text-muted-foreground">依托 Telegram 账号静默完成，无需任何额外操作</p>
      </div>
    </main>
  )
}
