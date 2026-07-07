'use client'

import { useEffect, useRef, useState } from 'react'
import { ScanLine, Upload } from 'lucide-react'
import { useApp } from '@/lib/app-context'

type Phase = 'idle' | 'scanning' | 'verdict'

const scanLines = ['正在核算亏损深度…', '正在评估回本难度…', '正在生成阵亡证书…']

export function ScarUpload() {
  const { setStage, confirmLoss, lossAmount } = useApp()
  const [phase, setPhase] = useState<Phase>('idle')
  const [scanText, setScanText] = useState(scanLines[0])
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (phase !== 'scanning') return
    let i = 0
    const textTimer = setInterval(() => {
      i = (i + 1) % scanLines.length
      setScanText(scanLines[i])
    }, 850)
    const doneTimer = setTimeout(() => {
      confirmLoss(8361)
      setPhase('verdict')
    }, 2600)
    return () => {
      clearInterval(textTimer)
      clearTimeout(doneTimer)
    }
  }, [phase, confirmLoss])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setPhase('scanning')
  }

  if (phase === 'verdict') {
    return (
      <main className="red-flash flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-12">
        {/* 阵亡证书卡片 */}
        <div className="evidence-card rise-in flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl p-8 text-center">
          <p className="font-mono text-xs tracking-[0.35em] text-muted-foreground">OFFICIAL VERDICT · 官方核实</p>
          <div className="h-px w-full bg-border" />
          <p className="text-sm text-muted-foreground">经核实，你已官方阵亡</p>
          <p className="font-mono text-5xl font-bold tracking-tight text-destructive">
            ${lossAmount.toLocaleString()}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {'这个数字不再是耻辱，而是你的春天目标。'}
          </p>
          <div className="h-px w-full bg-border" />
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground">DUGOU SPRING · CERT NO. 0x8361</p>
        </div>

        <button
          type="button"
          onClick={() => setStage('app')}
          className="breathe w-full max-w-sm rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground"
        >
          接受这个数字，开始复活
        </button>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col gap-8 px-6 pb-10 pt-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">交出你的伤疤</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">上传你的合约亏损截图。我们把耻辱感，做成一场仪式。</p>
      </header>

      <div className="flex flex-1 items-center justify-center">
        {phase === 'idle' ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="dash-glow flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-4 rounded-3xl bg-card/50 text-muted-foreground transition-colors active:bg-card"
          >
            <Upload className="size-10 text-primary" aria-hidden="true" />
            <span className="text-lg font-bold text-foreground">交出你的伤疤</span>
            <span className="text-xs">点击选择亏损截图</span>
          </button>
        ) : (
          <div className="relative flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-primary/40 bg-card/70">
            <div className="scan-laser absolute left-0 h-[3px] w-full bg-primary shadow-[0_0_18px_2px_oklch(0.74_0.17_55/70%)]" aria-hidden="true" />
            <ScanLine className="size-10 animate-pulse text-primary" aria-hidden="true" />
            {fileName && <p className="max-w-[80%] truncate font-mono text-xs text-muted-foreground">{fileName}</p>}
            <p className="animate-pulse text-sm text-foreground" aria-live="polite">
              {scanText}
            </p>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={onFileChange} aria-label="上传亏损截图" />
      </div>

      <p className="text-center text-xs text-muted-foreground">首次入场赠送体验额度，可先免费试玩一次完整开箱流程</p>
    </main>
  )
}
