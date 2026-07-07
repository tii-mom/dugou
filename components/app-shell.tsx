'use client'

import { AppProvider, useApp } from '@/lib/app-context'
import { Splash } from '@/components/splash'
import { Gate } from '@/components/gate'
import { ScarUpload } from '@/components/scar-upload'
import { BelieverStake } from '@/components/believer-stake'
import { Dashboard } from '@/components/dashboard'
import { Den } from '@/components/den'
import { Honor } from '@/components/honor'
import { Profile } from '@/components/profile'
import { BottomNav } from '@/components/bottom-nav'

function Shell() {
  const { stage, tab } = useApp()

  return (
    <div className="relative mx-auto min-h-dvh max-w-md">
      <div className="kline-bg" aria-hidden="true" />
      {stage === 'splash' && <Splash />}
      {stage === 'gate' && <Gate />}
      {stage === 'scar' && <ScarUpload />}
      {stage === 'stake' && <BelieverStake />}
      {stage === 'app' && (
        <main className="relative min-h-dvh">
          {tab === 'home' && <Dashboard />}
          {tab === 'den' && <Den />}
          {tab === 'honor' && <Honor />}
          {tab === 'profile' && <Profile />}
          <BottomNav />
        </main>
      )}
    </div>
  )
}

export function AppShell() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
