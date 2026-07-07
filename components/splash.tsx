'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/app-context'
import { Ticker } from '@/components/ticker'

const verifySteps = ['正在确认身份…', '正在创建内置钱包…', '欢迎回家']

export function Splash() {
  const { setStage } = useApp()
  const [verifying, setVerifying] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)

  useEffect(() => {
    if (!verifying) return
    const t1 = setTimeout(() => setStepIdx(1), 500)
    const t2 = setTimeout(() => setStepIdx(2), 1000)
    const t3 = setTimeout(() => setStage('gate'), 1500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [verifying, setStage])

  return (
    <main className="relative flex min-h-dvh flex-col justify-between overflow-hidden px-6 pb-10 pt-24">
      <div className="flex flex-1 flex-col justify-center gap-6">
        <p className="rise-in font-mono text-xs tracking-[0.4em] text-primary">DUGOU SPRING · D</p>
        <h1
          data-text="别怕，这里的人比你更惨"
          className="glitch rise-in text-balance text-4xl font-bold leading-tight text-foreground"
          style={{ animationDelay: '0.15s' }}
        >
          别怕，这里的人比你更惨
        </h1>
        <p className="rise-in text-pretty text-sm leading-relaxed text-muted-foreground" style={{ animationDelay: '0.3s' }}>
          赌狗也有春天。凌晨三点还在盯盘的人，都值得一次体面的回本。
        </p>
      </div>

      <div className="rise-in flex flex-col gap-8" style={{ animationDelay: '0.45s' }}>
        <Ticker />
        <button
          type="button"
          onClick={() => setVerifying(true)}
          disabled={verifying}
          className="breathe w-full rounded-2xl bg-primary py-5 text-lg font-bold text-primary-foreground transition-opacity disabled:opacity-80"
        >
          <span aria-live="polite">{verifying ? verifySteps[stepIdx] : '确认身份，进入春天'}</span>
        </button>
        <p className="text-center text-xs text-muted-foreground">依托 Telegram 账号静默完成，无需任何额外操作</p>
      </div>
    </main>
  )
}
