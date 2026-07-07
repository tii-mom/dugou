'use client'

import { useState } from 'react'
import { Crown, Flag, Flame, Lock, Megaphone, Radio, Star, Swords } from 'lucide-react'
import { believers, inviteLines, teamMembers, teamTitles } from '@/lib/mock-data'

const TEAM_PROGRESS = 0.54

export function Den() {
  const [panelOpen, setPanelOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [beaconSent, setBeaconSent] = useState(false)
  const invite = inviteLines[0]

  return (
    <div className="flex flex-col gap-6 px-5 pb-28 pt-5">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold">回本敢死队</h1>
          <p className="text-xs text-muted-foreground">地下据点 · {teamMembers.length} 名成员 · {believers.length} 位守望信徒</p>
        </div>
        <span className="rounded-full border border-primary/50 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
          S1 赛季
        </span>
      </header>

      {/* 队伍集体进度容器 */}
      <section className="evidence-card flex flex-col gap-5 rounded-3xl p-6" aria-label="队伍集体进度">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">集体目标进度</span>
          <span className="font-mono text-lg font-bold text-success">{Math.round(TEAM_PROGRESS * 100)}%</span>
        </div>
        <div className="relative h-8 w-full overflow-hidden rounded-full border border-border bg-secondary/60">
          <div
            className="liquid-surface absolute inset-y-0 left-0 rounded-full bg-success/80"
            style={{ width: `${TEAM_PROGRESS * 100}%`, boxShadow: '6px 0 20px oklch(0.75 0.16 155 / 50%)' }}
          />
        </div>

        {/* 成员环绕 */}
        <ul className="flex flex-wrap items-end justify-center gap-4" aria-label="队伍成员">
          {teamMembers.map((m) => (
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
              {/* 个人进度环形条（简化为微型条） */}
              <div className="h-1 w-10 overflow-hidden rounded-full bg-secondary" aria-label={`${m.name} 个人进度 ${Math.round(m.progress * 100)}%`}>
                <div
                  className={`h-full rounded-full ${m.progress >= 0.5 ? 'bg-success' : 'bg-muted-foreground/50'}`}
                  style={{ width: `${m.progress * 100}%` }}
                />
              </div>
            </li>
          ))}
          {/* 信徒外圈 */}
          {believers.map((b) => (
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

      {/* 狗爹操作面板 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-4">
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="flex items-center justify-between text-left"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-primary">
            <Crown className="size-4" aria-hidden="true" />
            狗爹操作面板
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
            <button type="button" className="flex items-center gap-3 rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-bold">
              <Flag className="size-4 text-primary" aria-hidden="true" />
              队伍目标设置
            </button>
          </div>
        )}
      </section>

      {/* 招募令卡片预览 */}
      {inviteOpen && (
        <section className="evidence-card rise-in flex flex-col gap-4 rounded-3xl border-primary/50 p-6">
          <p className="font-mono text-xs tracking-[0.3em] text-primary">RECRUIT ORDER · 招募令</p>
          <p className="text-lg font-bold leading-snug">{invite}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>集体进度 {Math.round(TEAM_PROGRESS * 100)}%</span>
            <span>已有 {teamMembers.length} 人入伙</span>
          </div>
          <div className="flex gap-3">
            <button type="button" className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
              转发到 Telegram
            </button>
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground"
            >
              关闭
            </button>
          </div>
        </section>
      )}

      {/* 救援信标 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-destructive" aria-hidden="true" />
          <h2 className="text-sm font-bold">救援信标</h2>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          进度卡在瓶颈期？发射一枚求救信标，邀请三位好友为你举火。每位好友点击后为你的进度条注入一小笔燃料，好友自己也能获得小额体验代币。
        </p>
        <button
          type="button"
          onClick={() => setBeaconSent(true)}
          disabled={beaconSent}
          className="rounded-xl border border-destructive/50 bg-destructive/10 py-3 text-sm font-bold text-destructive disabled:opacity-60"
        >
          {beaconSent ? '信标已发射 · 等待好友举火 0/3' : '发射求救信标'}
        </button>
      </section>

      {/* 全网 Boss 战 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Swords className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-bold">全网集体 Boss 战</h2>
        </div>
        <p className="font-mono text-2xl font-bold text-destructive">$128,406,772</p>
        <p className="text-xs text-muted-foreground">全网已上传亏损总和。所有人共同存款攻打这个数字，阶段性里程碑达成后瓜分奖励池。</p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: '31%' }} />
        </div>
        <p className="text-right font-mono text-[10px] text-muted-foreground">全网讨伐进度 31%</p>
      </section>

      {/* 称谓陈列墙 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold">称谓陈列墙</h2>
        <div className="grid grid-cols-2 gap-3">
          {teamTitles.map((t) => (
            <div
              key={t.name}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center ${
                t.unlocked ? 'border-primary/50 bg-primary/10' : 'border-border bg-card opacity-60'
              }`}
            >
              {t.unlocked ? (
                <Flame className="size-5 text-primary" aria-hidden="true" />
              ) : (
                <Lock className="size-5 text-muted-foreground" aria-hidden="true" />
              )}
              <span className={`text-sm font-bold ${t.unlocked ? 'text-primary' : 'text-muted-foreground'}`}>{t.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {t.unlocked ? '已解锁' : `需集体进度 ${Math.round(t.threshold * 100)}%`}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
