'use client'

import { Crown, CreditCard, Shield, Star } from 'lucide-react'
import { useApp } from '@/lib/app-context'

export function Profile() {
  const { role, lossAmount, holdingsValue, streak, unlocked } = useApp()
  const isGambler = role !== 'believer'

  return (
    <div className="flex flex-col gap-6 px-5 pb-28 pt-5">
      {/* 终极称谓候选区 */}
      <section className="evidence-card flex flex-col items-center gap-3 rounded-3xl p-8 text-center" aria-label="称谓候选区">
        <div
          className={`flex size-28 items-center justify-center rounded-full border-4 border-dashed ${
            unlocked ? 'border-primary text-primary' : 'border-border text-muted-foreground'
          }`}
        >
          <Crown className="size-10" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold">命运的主人</h2>
        <p className="font-mono text-xs text-muted-foreground">
          {unlocked ? '你的春天已至，队友已有 3/6 归乡' : '自身解锁 + 半数以上狗仔解锁后点亮'}
        </p>
        <div className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: unlocked ? '75%' : '42%' }} />
        </div>
      </section>

      {/* 身份铭牌 */}
      <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
        <div
          className={`flex size-14 items-center justify-center rounded-full text-lg font-bold ${
            isGambler
              ? 'border-2 border-primary bg-primary/15 text-primary shadow-[0_0_16px_oklch(0.74_0.17_55/40%)]'
              : 'border border-success/50 bg-success/10 text-success'
          }`}
        >
          我
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">匿名的兄弟</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                isGambler ? 'bg-primary text-primary-foreground' : 'bg-success/20 text-success'
              }`}
            >
              {isGambler ? '狗仔 · 亏损证明者' : '信徒 · 守林人'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">S1 赛季 · 连胜 {streak} 天</span>
        </div>
        {!isGambler && <Star className="size-4 fill-success text-success" aria-hidden="true" />}
      </section>

      {/* 账单 */}
      <section className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">官方阵亡金额</span>
          <span className="font-mono text-xl font-bold text-destructive">-${lossAmount.toLocaleString()}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
          <span className="text-xs text-muted-foreground">当前持仓市值</span>
          <span className="font-mono text-xl font-bold text-success">${Math.round(holdingsValue).toLocaleString()}</span>
        </div>
      </section>

      {/* 入金通道 */}
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-bold">一键入金通道</h2>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          直接使用绑定银行卡或 Telegram Stars 购买存款额度，无需先购买 USDT 再转入钱包。
        </p>
        <div className="flex gap-3">
          <button type="button" className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
            银行卡入金
          </button>
          <button type="button" className="flex-1 rounded-xl border border-border bg-secondary py-3 text-sm font-bold">
            Telegram Stars
          </button>
        </div>
      </section>

      <section className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <Shield className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          身份由 Telegram 账号体系静默验证，内置钱包已自动创建。全程无区块链术语，无助记词负担。
        </p>
      </section>
    </div>
  )
}
