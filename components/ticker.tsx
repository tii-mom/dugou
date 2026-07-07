'use client'

import { tickerMessages } from '@/lib/mock-data'

export function Ticker() {
  const doubled = [...tickerMessages, ...tickerMessages]
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card/60 py-2" aria-hidden="true">
      <div className="ticker-track">
        {doubled.map((msg, i) => (
          <span key={i} className="whitespace-nowrap px-6 text-xs text-muted-foreground">
            <span className="mr-2 inline-block size-1.5 rounded-full bg-success align-middle" />
            {msg}
          </span>
        ))}
      </div>
    </div>
  )
}
