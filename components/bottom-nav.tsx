'use client'

import { Crosshair, Rocket, User } from 'lucide-react'
import { useApp, type Tab } from '@/lib/app-context'

const tabs: { id: Tab; label: string; icon: typeof Crosshair }[] = [
  { id: 'home', label: '战场', icon: Crosshair },
  { id: 'sale', label: '翻身仗', icon: Rocket },
  { id: 'profile', label: '我的', icon: User },
]

export function BottomNav() {
  const { tab, setTab } = useApp()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md"
      aria-label="主导航"
    >
      <div className="tg-bottom-nav mx-auto flex max-w-md items-stretch justify-between px-2 pt-1">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-bold transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground active:text-foreground'
              }`}
            >
              {active && (
                <span
                  className="tab-active-dot absolute top-0 h-0.5 w-8 rounded-full bg-primary shadow-[0_0_8px_oklch(0.74_0.17_55/70%)]"
                  aria-hidden="true"
                />
              )}
              <Icon className={`size-5 transition-transform ${active ? 'scale-110' : ''}`} aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
