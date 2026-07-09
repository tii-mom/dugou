'use client'

import { useEffect, useState } from 'react'
import { Crown, Flag, Flame, Lock, Megaphone, Radio, Star, Swords, Award } from 'lucide-react'
import { getBusinessService } from '@/lib/services'
import { ShareCard } from '@/components/share-card'

const community = getBusinessService().getCommunitySnapshot()

export function Den() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [beaconSent, setBeaconSent] = useState(false)
  const [helpers, setHelpers] = useState(0)
  const [inviteIdx, setInviteIdx] = useState(0)
  const invite = community.inviteLines[inviteIdx]

  useEffect(() => {
    if (!beaconSent || helpers >= 3) return
    const t = setTimeout(() => setHelpers((h) => h + 1), 2500 + helpers * 700)
    return () => clearTimeout(t)
  }, [beaconSent, helpers])

  function handleSendBeacon() {
    setBeaconSent(true)
  }

  return (
    <div className="page-fade flex flex-col gap-6 px-5 pb-28 pt-5">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold">春天守望队</h1>
          <p className="text-xs text-muted-foreground">队伍空间 · {community.members.length} 名演示成员 · {community.believers.length} 位演示支持者</p>
        </div>
        <span className="rounded-full border border-primary/50 bg-primary/10 px-3 py-1 font-mono text-xs text-primary animate-pulse">
          S1 赛季
        </span>
      </header>

      {/* 队伍集体进度容器 */}
      <section className="evidence-card flex flex-col gap-5 rounded-3xl p-6" aria-label="队伍集体进度">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">集体目标进度</span>
          <span className="font-mono text-lg font-bold text-success">{Math.round(community.teamProgress * 100)}%</span>
        </div>
        <div className="relative h-8 w-full overflow-hidden rounded-full border border-border bg-secondary/60">
          <div
            className="liquid-surface shimmer absolute inset-y-0 left-0 rounded-full bg-success/80"
            style={{ width: `${community.teamProgress * 100}%`, boxShadow: '6px 0 20px oklch(0.75 0.16 155 / 50%)' }}
          />
        </div>

        {/* 成员环绕 */}
        <ul className="flex flex-wrap items-end justify-center gap-4" aria-label="队伍成员">
          {community.members.map((m) => (
            <li key={m.id} className="flex flex-col items-center gap-1.5">
              <div className="relative">
                <div
                  className={`flex size-12 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                    m.role === 'father'
                      ? 'border-primary bg-primary/20 text-primary shadow-[0_0_16px_oklch(0.74_0.17_55/50%)]'
                      : m.lit
                        ? 'border-primary/60 bg-card text-foreground'
                        : 'border-border bg-secondary text-muted-foreground'
                  }`}
                >
                  {m.name.slice(0, 1)}
                </div>
                {m.role === 'father' && (
                  <Crown className="absolute -top-2 left-1/2 size-4 -translate-x-1/2 text-primary" aria-hidden="true" />
                )}
              </div>
              <span className={`text-[10px] ${m.role === 'father' ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                {m.name}
              </span>
              {/* 个人进度环形条 */}
              <div className="h-1 w-10 overflow-hidden rounded-full bg-secondary" aria-label={`${m.name} 个人进度 ${Math.round(m.progress * 100)}%`}>
                <div
                  className={`h-full rounded-full ${m.progress >= 0.5 ? 'bg-success' : 'bg-muted-foreground/50'}`}
                  style={{ width: `${m.progress * 100}%` }}
                />
              </div>
            </li>
          ))}
          {/* 支持者外圈 */}
          {community.believers.map((b) => (
            <li key={b.id} className="flex flex-col items-center gap-1.5 opacity-75">
              <div className="relative flex size-9 items-center justify-center rounded-full border border-success/40 bg-card text-xs text-success">
                {b.name.slice(0, 1)}
                <Star className="absolute -right-1 -top-1 size-3 fill-success text-success" aria-hidden="true" />
              </div>
              <span className="text-[10px] text-muted-foreground">{b.name}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 称谓陈列墙 */}
      <section className="evidence-card flex flex-col gap-3 rounded-3xl p-5">
        <div className="flex items-center gap-2">
          <Award className="size-4 text-primary" />
          <h2 className="text-sm font-bold">队伍称谓陈列墙</h2>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {community.titles.map((title) => (
            <div
              key={title.name}
              className={`flex flex-col gap-1 rounded-2xl border p-3.5 text-left transition-all ${
                title.unlocked
                  ? 'border-primary/50 bg-primary/5 legendary-glow'
                  : 'border-border bg-card/40 opacity-40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">{title.name}</span>
                {!title.unlocked && <Lock className="size-3 text-muted-foreground" />}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {title.unlocked ? '已解锁' : `团队目标达到 ${Math.round(title.threshold * 100)}% 解锁`}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Team lead panel */}
      <section className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-4">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="flex items-center justify-between text-left"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-primary">
            <Crown className="size-4" aria-hidden="true" />
            队长操作面板
          </span>
          <span className="text-xs text-muted-foreground">{panelOpen ? '收起' : '展开'}</span>
        </button>
        {panelOpen && (
          <div className="rise-in flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-3 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
            >
              <Megaphone className="size-4" aria-hidden="true" />
              生成招募令
            </button>
            <button type="button" disabled className="flex items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-bold opacity-55">
              <Flag className="size-4 text-primary" aria-hidden="true" />
              队伍目标设置待接入
            </button>
          </div>
        )}
      </section>

      {/* 招募令卡片预览 */}
      {inviteOpen && (
        <section className="evidence-card rise-in flex flex-col gap-4 rounded-3xl border-primary/50 p-6">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs tracking-[0.3em] text-primary">RECRUIT ORDER · 招募令</p>
            <button
              type="button"
              onClick={() => setInviteIdx((i) => (i + 1) % community.inviteLines.length)}
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              换一句
            </button>
          </div>
          <p className="text-sm font-bold leading-snug">{invite}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>演示进度 {Math.round(community.teamProgress * 100)}%</span>
            <span>已有 {community.members.length} 名演示成员</span>
          </div>
          <ShareCard
            title="分发招募令"
            description="把队伍入口发到社交平台，真实邀请归因待后端接入。"
            text={`【演示招募令】${invite}！当前团队数据为演示占位，后端接入后展示真实队伍进度。`}
            compact
          />
          <button
            type="button"
            onClick={() => setInviteOpen(false)}
            className="w-full rounded-xl border border-border py-2 text-xs text-muted-foreground"
          >
            关闭预览
          </button>
        </section>
      )}

      {/* 救援信标 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-destructive" aria-hidden="true" />
          <h2 className="text-sm font-bold">救援信标</h2>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          进度卡在瓶颈期？发射一枚演示求助信标，查看邀请任务的前端流程。真实好友助力、进度记录和权益规则需要后端任务接口返回。
        </p>
        {beaconSent && (
          <div className="flex items-center gap-2" aria-label={`已有 ${helpers} 位好友助力`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`flex size-8 items-center justify-center rounded-full border transition-colors ${
                  i < helpers ? 'border-primary bg-primary/20 text-primary' : 'border-border bg-secondary text-muted-foreground'
                }`}
              >
                <Flame className="size-3.5" aria-hidden="true" />
              </span>
            ))}
            <span className="ml-1 font-mono text-xs text-muted-foreground" aria-live="polite">
              {helpers >= 3 ? '演示助力已完成，进度 +2%' : `${helpers}/3 位好友已助力`}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={handleSendBeacon}
          disabled={beaconSent}
          className="rounded-xl border border-destructive/50 bg-destructive/10 py-3 text-sm font-bold text-destructive transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {beaconSent ? (helpers >= 3 ? '信标任务完成' : '信标已发射 · 等待好友助力') : '发射求助信标'}
        </button>
        {beaconSent && !inviteOpen && (
          <ShareCard
            title="扩散求助信标"
            description="将求助信标发到社交平台，好友任务仍为演示状态。"
            text="【演示求助信号】我的春天进度卡在瓶颈期了！当前为前端演示流程，好友助力和权益规则等待后端任务接口接入。"
            compact
          />
        )}
      </section>

      {/* 全网 Boss 战 (带可视化进度条和里程碑标记) */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Swords className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-bold">全网集体目标（演示）</h2>
        </div>

        <div className="flex flex-col gap-1">
          <p className="font-mono text-2xl font-bold text-destructive animate-pulse">${community.bossTotalLossUsd.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">演示用全网亏损总和。后端统计接口接入前，不代表真实用户上传数据。</p>
        </div>

        {/* 进度条 */}
        <div className="relative h-4 w-full rounded-full bg-secondary overflow-hidden mt-1 border border-border">
          <div
            className="h-full bg-gradient-to-r from-destructive to-primary transition-all duration-1000"
            style={{ width: `${(community.bossTotalLossUsd / community.bossTargetUsd) * 100}%` }}
          />
        </div>

        {/* 里程碑标记 */}
        <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-0.5">
          <span>S1里程碑: $1亿 (演示)</span>
          <span>S2里程碑: $5亿 (待接入)</span>
        </div>
      </section>
    </div>
  )
}
