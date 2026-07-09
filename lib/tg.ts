type TelegramUser = {
  username?: string
  first_name?: string
  last_name?: string
}

type TelegramWebApp = {
  version?: string
  initData?: string
  initDataUnsafe?: {
    user?: TelegramUser
  }
  ready?: () => void
  expand?: () => void
  openTelegramLink?: (url: string) => void
  openLink?: (url: string, options?: unknown) => void
  openInvoice?: (url: string, callback?: (status: string) => void) => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  disableVerticalSwipes?: () => void
}

type ExchangeInviteConfig = {
  okxInviteUrl: string
  binanceInviteUrl: string
}

function cleanEnv(value: string | undefined) {
  return value?.trim() || ''
}

function getCurrentUrl() {
  if (typeof window === 'undefined') return ''
  return window.location.href || window.location.origin || ''
}

function versionAtLeast(version: string | undefined, target: string) {
  if (!version) return false
  const currentParts = version.split('.').map((part) => Number(part) || 0)
  const targetParts = target.split('.').map((part) => Number(part) || 0)
  const maxLength = Math.max(currentParts.length, targetParts.length)

  for (let i = 0; i < maxLength; i += 1) {
    const current = currentParts[i] || 0
    const required = targetParts[i] || 0
    if (current > required) return true
    if (current < required) return false
  }

  return true
}

export function getPublicAppUrl() {
  return (
    cleanEnv(process.env.NEXT_PUBLIC_TELEGRAM_APP_URL) ||
    cleanEnv(process.env.NEXT_PUBLIC_TG_APP_URL) ||
    cleanEnv(process.env.NEXT_PUBLIC_APP_URL) ||
    getCurrentUrl()
  )
}

export function getExchangeInviteConfig(): ExchangeInviteConfig {
  return {
    okxInviteUrl: cleanEnv(process.env.NEXT_PUBLIC_OKX_INVITE_URL),
    binanceInviteUrl: cleanEnv(process.env.NEXT_PUBLIC_BINANCE_INVITE_URL),
  }
}

// 安全调用 Telegram WebApp SDK。initData 只能送到服务端验签，前端不做伪校验。
export function getTG(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp || null
}

export function getTelegramInitData() {
  return getTG()?.initData || ''
}

export function getTelegramRuntimeState() {
  const webApp = getTG()
  return {
    sdkAvailable: Boolean(webApp),
    initDataPresent: Boolean(webApp?.initData),
    canOpenInvoice: typeof webApp?.openInvoice === 'function',
  }
}

export function initializeTelegramWebApp() {
  const webApp = getTG()
  if (!webApp) return getTelegramRuntimeState()

  try {
    webApp.ready?.()
    webApp.expand?.()
    if (versionAtLeast(webApp.version, '6.1')) {
      webApp.setHeaderColor?.('#0e0e14')
      webApp.setBackgroundColor?.('#0e0e14')
    }
    if (versionAtLeast(webApp.version, '7.7')) {
      webApp.disableVerticalSwipes?.()
    }
  } catch {
    // Telegram 客户端版本能力不一致，初始化失败不阻断普通浏览器访问。
  }

  return getTelegramRuntimeState()
}

export function openExternalUrl(url: string) {
  if (!url || typeof window === 'undefined') return false

  try {
    const webApp = getTG()
    const isTelegramUrl = /^https:\/\/(t\.me|telegram\.me)\//i.test(url)

    if (isTelegramUrl && typeof webApp?.openTelegramLink === 'function') {
      webApp.openTelegramLink(url)
      return true
    }

    if (/^https?:\/\//i.test(url) && typeof webApp?.openLink === 'function') {
      webApp.openLink(url)
      return true
    }

    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (opened) return true

    window.location.assign(url)
    return true
  } catch {
    return false
  }
}

// 获取 Telegram 用户名。initDataUnsafe 仅用于展示，真实身份必须由服务端校验 initData。
export function getTGUsername(): string {
  const user = getTG()?.initDataUnsafe?.user
  if (user) {
    return user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim() || '匿名的兄弟'
  }
  return '匿名的兄弟'
}
