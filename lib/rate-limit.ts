import { getSessionUser } from './auth-server'

interface RateLimitOptions {
  route: string
  limit: number
  windowSec?: number
  userId?: string
  walletAddress?: string
  telegramId?: string
}

export async function isRateLimited(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  options: RateLimitOptions
): Promise<boolean> {
  const isProd = process.env.NODE_ENV === 'production'

  if (!db) {
    if (isProd) {
      // Fail-closed in production if DB is missing
      return true
    }
    // Local dev without DB bypasses rate limit
    return false
  }

  let key = 'anonymous'

  // 1. Prioritize session user id
  if (options.userId) {
    key = options.userId
  } else {
    try {
      const user = await getSessionUser(request, db)
      if (user?.id) {
        key = user.id
      }
    } catch {}
  }

  // 2. Fallback to wallet address if still anonymous
  if (key === 'anonymous' && options.walletAddress) {
    key = options.walletAddress
  }

  // 3. Fallback to Telegram user ID if still anonymous
  if (key === 'anonymous' && options.telegramId) {
    key = options.telegramId
  }

  // 4. Fallback to IP address if still anonymous
  if (key === 'anonymous') {
    const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('cf-connecting-ip')
    if (ip) {
      key = ip
    }
  }

  const windowSec = options.windowSec || 60
  const nowUnix = Math.floor(Date.now() / 1000)
  const windowStart = nowUnix - (nowUnix % windowSec)
  const nowIso = new Date().toISOString()

  try {
    await db.prepare(`
      INSERT INTO diao_rate_limits (key, route, window_start, request_count, updated_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(key, route, window_start) DO UPDATE SET
        request_count = request_count + 1,
        updated_at = EXCLUDED.updated_at
    `).bind(key, options.route, windowStart, nowIso).run()

    const row = await db.prepare(`
      SELECT request_count FROM diao_rate_limits
      WHERE key = ? AND route = ? AND window_start = ?
    `).bind(key, options.route, windowStart).first()

    const count = row?.request_count ? Number(row.request_count) : 1
    return count > options.limit
  } catch (dbErr) {
    console.error('Rate limit D1 error:', dbErr)
    if (isProd) {
      // Fail-closed in production if D1 write fails
      return true
    }
    return false
  }
}
