'use client'

import { useEffect } from 'react'
import { initializeTelegramWebApp } from '@/lib/tg'

export function TelegramWebAppInit() {
  useEffect(() => {
    initializeTelegramWebApp()
  }, [])

  return null
}
