'use client'

import { useEffect, useRef, useState } from 'react'
import { ScanLine, Upload, Sparkles, Target } from 'lucide-react'
import { useApp } from '@/lib/app-context'
import { type LossProofFile } from '@/lib/services'
import { ShareCard } from '@/components/share-card'
import { DIAO_TOKENOMICS } from '@/lib/ton-config'

type Phase = 'idle' | 'scanning' | 'verdict'

const scanLines = ['正在读取截图信息…', '正在创建审核请求…', '等待后端核验…']
const MAX_FILE_SIZE = 8 * 1024 * 1024

export function ScarUpload() {
  const { setStage, setTab, submitLossProof, lossClaim, startTrial } = useApp()
  const [phase, setPhase] = useState<Phase>('idle')
  const [scanText, setScanText] = useState(scanLines[0])
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileMeta, setFileMeta] = useState<LossProofFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (phase !== 'scanning') return
    let i = 0
    const textTimer = setInterval(() => {
      i = (i + 1) % scanLines.length
      setScanText(scanLines[i])
    }, 850)
    const doneTimer = setTimeout(() => {
      if (!fileMeta) return
      void submitLossProof(fileMeta).finally(() => {
        setPhase('verdict')
      })
    }, 2600)
    return () => {
      clearInterval(textTimer)
      clearTimeout(doneTimer)
    }
  }, [phase, fileMeta, submitLossProof])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('请上传 PNG、JPG 或 WebP 等图片格式的亏损截图。')
      e.target.value = ''
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('图片超过 8MB，请压缩后重新上传。')
      e.target.value = ''
      return
    }
    setFileName(file.name)
    setFileMeta({
      name: file.name,
      size: file.size,
      type: file.type,
      arrayBuffer: () => file.arrayBuffer(),
    })
    setPhase('scanning')
  }

  if (phase === 'verdict') {
    const hasAmount = lossClaim.amountUsd != null && lossClaim.amountUsd > 0
    const isPending = lossClaim.status === 'pending_review'
    const isRejected = lossClaim.status === 'rejected'
    const flipTarget = lossClaim.amountUsd ?? 0
    const requiredDiao = flipTarget > 0 ? Math.ceil(flipTarget / DIAO_TOKENOMICS.round18PriceUsd) : 0

    return (
      <main className="red-flash flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="evidence-card rise-in flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl p-8 text-center">
          {isPending && (
            <>
              <p className="font-mono text-xs tracking-[0.35em] text-muted-foreground">战场正在核验</p>
              <div className="h-px w-full bg-border" />
              <div className="flex size-16 items-center justify-center rounded-full border border-primary/50 bg-primary/10 animate-pulse">
                <ScanLine className="size-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">截图已提交，正在等待后端审核确认金额。</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{lossClaim.message}</p>
            </>
          )}

          {isRejected && (
            <>
              <p className="font-mono text-xs tracking-[0.35em] text-destructive">审核未通过</p>
              <div className="h-px w-full bg-border" />
              <p className="text-sm text-destructive">{lossClaim.message || '截图审核未通过，请重新上传。'}</p>
            </>
          )}

          {hasAmount && !isPending && !isRejected && (
            <>
              <p className="font-mono text-xs tracking-[0.35em] text-muted-foreground">亏损已确认</p>
              <div className="h-px w-full bg-border" />
              <p className="font-mono text-5xl font-bold tracking-tight text-destructive">
                -${flipTarget.toLocaleString()}
              </p>
              <div className="grid w-full grid-cols-2 gap-3 text-left">
                <div className="rounded-2xl border border-border bg-secondary/40 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">翻身目标</p>
                  <p className="font-mono text-sm font-bold text-primary">${flipTarget.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/40 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">所需 DIAO</p>
                  <p className="font-mono text-sm font-bold text-foreground">{requiredDiao.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 border border-primary/30">
                <Target className="size-4 text-primary shrink-0" />
                <p className="text-[11px] text-primary">
                  第 18 轮目标价 <span className="font-mono font-bold">${DIAO_TOKENOMICS.round18PriceUsd}</span>，
                  持有 {requiredDiao.toLocaleString()} DIAO 即可理论翻身。
                </p>
              </div>
            </>
          )}

          <div className="h-px w-full bg-border" />
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground">DAWN IS ALWAYS OURS</p>
        </div>

        <div className="flex w-full max-w-sm flex-col gap-3">
          {isRejected ? (
            <button
              type="button"
              onClick={() => { setPhase('idle'); setFileName(null); setFileMeta(null) }}
              className="breathe w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground transition-all active:scale-95"
            >
              重新上传
            </button>
          ) : hasAmount ? (
            <button
              type="button"
              onClick={() => { setStage('app'); setTab('sale') }}
              className="breathe w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground transition-all active:scale-95"
            >
              去赌狗翻身仗补票
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setStage('app'); setTab('home') }}
              className="breathe w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground transition-all active:scale-95"
            >
              进入战场查看状态
            </button>
          )}

          <ShareCard
            title="分享我的战绩"
            description="分享到社交平台，邀请更多人一起翻身。"
            text={hasAmount
              ? `我在合约里亏了 $${flipTarget.toLocaleString()}，翻身目标 $${flipTarget.toLocaleString()}，需要 ${requiredDiao.toLocaleString()} DIAO。第18轮目标价 $2.62144。赌狗也有春天，来一起翻身！`
              : '我已提交亏损记录，等待审核确认目标。赌狗也有春天，邀你一起加入！'}
            compact
          />
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col gap-8 px-6 pb-10 pt-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">提交亏损截图</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          系统会识别你的合约亏损，并生成翻身目标。
        </p>
        {error && (
          <p className="rounded-xl border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive" aria-live="assertive">
            {error}
          </p>
        )}
      </header>

      <section className="rise-in flex items-center justify-between rounded-2xl border border-primary/35 bg-primary/5 p-4" style={{ animationDelay: '0.05s' }}>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <Sparkles className="size-3.5" />
            无门槛试玩通道
          </span>
          <span className="text-[11px] text-muted-foreground">免截图/免验证，仅体验模拟流程</span>
        </div>
        <button
          type="button"
          onClick={startTrial}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-all active:scale-95"
        >
          试玩一次
        </button>
      </section>

      <div className="flex flex-1 items-center justify-center">
        {phase === 'idle' ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="dash-glow flex aspect-square w-full max-w-sm flex-col items-center justify-center gap-4 rounded-3xl bg-card/50 text-muted-foreground transition-colors active:bg-card"
          >
            <Upload className="size-10 text-primary" aria-hidden="true" />
            <span className="text-lg font-bold text-foreground">提交亏损截图</span>
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

      <p className="text-center text-xs text-muted-foreground">真实金额需后端 OCR/审核接口返回；试玩额度只用于演示流程</p>
    </main>
  )
}
