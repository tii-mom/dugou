'use client'

import { Home, Medal, PawPrint, User } from 'lucide-react'
import { useApp, type Tab } from '@/lib/app-context'

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: '战场', icon: Home },
  { id: 'den', label: '狗窝', icon: PawPrint },
  { id: 'honor', label: '荣誉室', icon: Medal },
  { id: 'profile', label: '我的', icon: User },
]

export function BottomNav() {
  const { tab, setTab } = useApp()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-md"
      aria-label="主导航"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-bold transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
