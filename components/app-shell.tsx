'use client'

import { TonConnectProvider } from '@/lib/ton-connect-provider'
import { AppProvider, useApp } from '@/lib/app-context'
import { ScarUpload } from '@/components/scar-upload'
import { Dashboard } from '@/components/dashboard'
import { TokenSale } from '@/components/token-sale'
import { Profile } from '@/components/profile'
import { BottomNav } from '@/components/bottom-nav'

function Shell() {
  const { stage, tab } = useApp()

  return (
    <div className="tg-safe-screen relative mx-auto min-h-dvh max-w-md overflow-x-hidden">
      <div className="kline-bg" aria-hidden="true" />
      {stage === 'scar' && <ScarUpload />}
      {stage === 'app' && (
        <main className="relative min-h-dvh">
          {tab === 'home' && <Dashboard />}
          {tab === 'sale' && <TokenSale />}
          {tab === 'profile' && <Profile />}
          <BottomNav />
        </main>
      )}
    </div>
  )
}

export function AppShell() {
  return (
    <TonConnectProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </TonConnectProvider>
  )
}
