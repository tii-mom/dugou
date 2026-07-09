import { getPublicAppUrl, openExternalUrl } from '@/lib/tg'

export type SharePlatform = 'telegram' | 'x' | 'binance_square' | 'okx_planet'

export const SHARE_PLATFORMS: Array<{ id: SharePlatform; label: string }> = [
  { id: 'telegram', label: 'Telegram' },
  { id: 'x', label: 'X' },
  { id: 'binance_square', label: '币安广场' },
  { id: 'okx_planet', label: 'OKX 星球' },
]

function cleanEnv(value: string | undefined) {
  return value?.trim() || ''
}

function getOkxPlanetUrl() {
  return cleanEnv(process.env.NEXT_PUBLIC_OKX_PLANET_URL)
}

export function getShareTags() {
  return ['DIAO', 'DawnIsAlwaysOurs', '赌狗也有春天']
}

export function withShareSignature(text: string) {
  return `${text}\n\nDawn Is Always Ours · DIAO`
}

export function shareToPlatform(platform: SharePlatform, text: string, url: string = getPublicAppUrl()) {
  const signedText = withShareSignature(text)

  if (platform === 'telegram') {
    const params = new URLSearchParams()
    if (url) params.set('url', url)
    params.set('text', signedText)
    return openExternalUrl(`https://t.me/share/url?${params.toString()}`)
  }

  if (platform === 'x') {
    const params = new URLSearchParams({
      text: signedText,
      hashtags: getShareTags().join(','),
    })
    if (url) params.set('url', url)
    return openExternalUrl(`https://x.com/intent/tweet?${params.toString()}`)
  }

  if (platform === 'binance_square') {
    const fullText = url ? `${signedText} ${url}` : signedText
    return openExternalUrl(`https://www.binance.com/zh-CN/square/post?text=${encodeURIComponent(fullText)}`)
  }

  const okxPlanetUrl = getOkxPlanetUrl()
  if (!okxPlanetUrl) return false
  return openExternalUrl(okxPlanetUrl)
}

export function getPlatformUnavailableMessage(platform: SharePlatform) {
  if (platform === 'okx_planet') return 'OKX 星球入口未配置，请先补充 NEXT_PUBLIC_OKX_PLANET_URL。'
  return '未能打开分享面板，请检查弹窗权限或客户端版本。'
}
