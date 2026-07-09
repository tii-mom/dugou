'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useApp } from '@/lib/app-context'
import { useCountUp } from '@/lib/use-count-up'
import { Ticker } from '@/components/ticker'
import { ClaimDiao } from '@/components/claim-diao'
import { ShareBattleCard } from '@/components/share-battle-card'
import { DIAO_TOKENOMICS } from '@/lib/ton-config'
import { DIAO_UNLOCK_ROUNDS } from '@/lib/token-sale'
import {
  Target, BarChart3, ChevronDown, ChevronUp,
  Loader2, Sparkles, LogOut,
} from 'lucide-react'

export function Dashboard() {
  const {
    lossClaim, setStage, setTab, isTrial, exitTrial,
    battlefieldData, battlefieldLoading, refreshBattlefield,
  } = useApp()

  const [showRules, setShowRules] = useState(false)

  // Use battlefield data or defaults
  const d = battlefieldData
  const lossUsd = d?.lossUsd ?? 0
  const flipTargetUsd = d?.flipTargetUsd ?? 0
  const requiredDiao = d?.requiredDiaoAtRound18 ?? 0
  const progressPercent = d?.progressPercent ?? 0
  const holdingValue = d?.holdingValueUsd ?? 0
  const diaoBalance = d?.diaoBalance ?? 0
  const currentPrice = d?.currentDiaoPrice ?? DIAO_TOKENOMICS.initialPriceUsd
  const currentRound = d?.currentRound ?? 0
  const nextUnlockPrice = d?.nextUnlockPrice ?? Number((DIAO_TOKENOMICS.initialPriceUsd * 2).toFixed(5))
  const purchasedPackages = d?.purchasedPackages ?? 0
  const totalSoldPackages = d?.totalSoldPackages ?? 0
  const circulatingSupply = d?.circulatingSupply ?? DIAO_TOKENOMICS.initialCirculation
  const lockedSupply = d?.lockedSupply ?? DIAO_TOKENOMICS.lockedSupply
  const totalWallets = d?.totalWallets ?? 0
  const lossStatus = d?.lossStatus ?? lossClaim.status

  const animPct = useCountUp(progressPercent)
  const animHolding = useCountUp(holdingValue)
  const animBalance = useCountUp(diaoBalance)

  const hasPurchase = purchasedPackages > 0
  const hasLoss = lossStatus === 'verified' && lossUsd > 0
  const isPending = lossStatus === 'pending_review'
  const notSubmitted = lossStatus === 'not_submitted'

  // Refresh on mount
  useEffect(() => {
    refreshBattlefield()
  }, [refreshBattlefield])

  const visibleRounds = [...DIAO_UNLOCK_ROUNDS.slice(0, 6), ...DIAO_UNLOCK_ROUNDS.slice(-2)]

  return (
    <div className="page-fade flex flex-col gap-5 px-5 pb-28 pt-5">
      <header className="flex items-center gap-3">
        <Image
          src="/icon.png"
          alt="DIAO"
          width={48}
          height={48}
          className="size-12 rounded-full border border-primary/35 bg-white object-cover"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-mono text-[10px] tracking-[0.28em] text-primary">DIAO BATTLEFIELD</span>
          <h1 className="text-xl font-black leading-tight text-foreground">提交亏损，计算翻身目标</h1>
          <p className="text-xs leading-relaxed text-muted-foreground">上传合约亏损截图，系统生成目标，再用 DIAO 追踪翻身进度。</p>
        </div>
      </header>

      <Ticker />

      {/* Trial mode banner */}
      {isTrial && (
        <section className="flex items-center justify-between rounded-2xl border border-primary/50 bg-primary/10 px-4 py-3 animate-pulse">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="text-xs font-bold text-primary">试玩模式（模拟数据）</span>
          </div>
          <button
            type="button"
            onClick={exitTrial}
            className="flex items-center gap-1 text-[11px] font-bold text-foreground bg-primary/20 hover:bg-primary/30 px-2 py-1 rounded-lg transition-colors"
          >
            <LogOut className="size-3" />
            退出
          </button>
        </section>
      )}

      {/* SECTION 1: Loss Identity */}
      <section className="evidence-card flex flex-col gap-4 rounded-3xl p-5 border border-primary/25">
        {notSubmitted && (
          <>
            <div className="flex items-center gap-2">
              <Target className="size-4 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground">你还没提交亏损截图</span>
            </div>
            <button
              type="button"
              onClick={() => setStage('scar')}
              className="breathe w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              提交亏损，计算翻身目标
            </button>
          </>
        )}
        {isPending && (
          <div className="flex items-center gap-3">
            <Loader2 className="size-5 text-primary animate-spin shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-primary">战场正在核验你的亏损</span>
              <span className="text-[11px] text-muted-foreground">截图已提交，等待后端审核</span>
            </div>
          </div>
        )}
        {hasLoss && (
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">你亏了</span>
              <span className="font-mono text-2xl font-bold text-destructive">
                -${lossUsd.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10px] text-muted-foreground">翻身目标</span>
              <span className="font-mono text-2xl font-bold text-primary">
                ${flipTargetUsd.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: Flip Progress */}
      {(hasLoss || hasPurchase) && (
        <section className="evidence-card flex flex-col items-center gap-4 rounded-3xl p-6" aria-label="翻身进度">
          <p className="font-mono text-5xl font-bold text-foreground">{animPct.toFixed(1)}%</p>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="shimmer absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-1000"
              style={{ width: `${Math.min(animPct, 100)}%` }}
            />
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-xs text-muted-foreground">
              持仓 <span className="font-mono font-bold text-foreground">{Math.round(animBalance).toLocaleString()}</span> DIAO
              · 价值 <span className="font-mono font-bold text-success">${Math.round(animHolding).toLocaleString()}</span>
            </p>
            <div className="flex items-center gap-1.5 mt-1 bg-secondary/35 px-2.5 py-1 rounded-full border border-border/30">
              <span className={`size-1.5 rounded-full ${
                d?.diaoBalanceSource === 'chain'
                  ? 'bg-success animate-pulse'
                  : d?.diaoBalanceSource === 'local_estimate'
                  ? 'bg-primary'
                  : 'bg-destructive'
              }`} />
              <span className="text-[9px] font-bold text-muted-foreground font-mono">
                {d?.diaoBalanceSource === 'chain'
                  ? '链上数据 (Chain)'
                  : d?.diaoBalanceSource === 'local_estimate'
                  ? '估算数据 (Estimate)'
                  : '数据未就绪 (Unavailable)'}
              </span>
            </div>
            {flipTargetUsd > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                距离目标还差 <span className="font-mono font-bold text-primary">${Math.max(0, Math.ceil(flipTargetUsd - holdingValue)).toLocaleString()}</span>
              </p>
            )}
          </div>
        </section>
      )}

      {/* SECTION 3: Token Status */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-bold">代币战况</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="当前轮次" value={currentRound > 0 ? `第 ${currentRound} 轮` : '未开始'} />
          <StatCard label="当前价格" value={`$${currentPrice}`} highlight />
          <StatCard label="下一轮解锁价" value={`$${nextUnlockPrice}`} />
          <StatCard label="第18轮目标价" value={`$${DIAO_TOKENOMICS.round18PriceUsd}`} highlight />
          <StatCard label="流通量" value={`${(circulatingSupply / 1e8).toFixed(1)} 亿`} />
          <StatCard label="锁仓量" value={`${(lockedSupply / 1e8).toFixed(1)} 亿`} />
          <StatCard label="已售份数" value={`${totalSoldPackages} / ${DIAO_TOKENOMICS.maxPackagesTotal}`} />
          <StatCard label="参与钱包" value={`${totalWallets}`} />
        </div>
      </section>

      {/* SECTION 4: My Claims */}
      {hasPurchase && (
        <ClaimDiao
          currentRound={currentRound}
          purchasedPackages={purchasedPackages}
          highestClaimedRound={d?.highestClaimedRound ?? 0}
        />
      )}

      {/* SECTION 5: Action Buttons */}
      {notSubmitted && !isTrial && (
        <button
          type="button"
          onClick={() => setStage('scar')}
          className="breathe w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
        >
          提交亏损，计算翻身目标
        </button>
      )}
      {hasLoss && !hasPurchase && (
        <button
          type="button"
          onClick={() => setTab('sale')}
          className="breathe w-full rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
        >
          进入赌狗翻身仗
        </button>
      )}

      {/* SECTION 6: Share Card */}
      {hasLoss && hasPurchase && (
        <ShareBattleCard
          lossUsd={lossUsd}
          flipTargetUsd={flipTargetUsd}
          requiredDiao={requiredDiao}
          progressPercent={progressPercent}
        />
      )}

      {/* SECTION 7: Rules (collapsible) */}
      <button
        type="button"
        onClick={() => setShowRules(!showRules)}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
      >
        {showRules ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {showRules ? '收起详细规则' : '查看详细规则'}
      </button>

      {showRules && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold">解锁规则</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            初始价格 ${DIAO_TOKENOMICS.initialPriceUsd.toFixed(5)}。每当价格较上一轮翻倍，释放 5 亿 DIAO。
            第 1-15 轮面向购买者释放，第 16-18 轮进入团队钱包。买家每轮可领 200,000 × 份数 DIAO。
          </p>
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[0.7fr_1.1fr_1fr_1.1fr] bg-secondary/60 px-3 py-2 text-[10px] font-bold text-muted-foreground">
              <span>轮次</span>
              <span>价格</span>
              <span>涨幅</span>
              <span>流向</span>
            </div>
            {visibleRounds.map((round, index) => (
              <div
                key={round.round}
                className={`grid grid-cols-[0.7fr_1.1fr_1fr_1.1fr] px-3 py-2 font-mono text-[10px] ${
                  index !== visibleRounds.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <span>第{round.round}轮</span>
                <span>${round.unlockPriceUsd.toFixed(5)}</span>
                <span>{round.multipleFromInitial.toLocaleString()}x</span>
                <span>{round.destination === 'participants' ? '参与者' : '团队'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Loading indicator */}
      {battlefieldLoading && (
        <div className="fixed right-4 top-4 z-50">
          <Loader2 className="size-4 animate-spin text-primary" />
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-border bg-card p-3">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm font-bold leading-tight ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  )
}
