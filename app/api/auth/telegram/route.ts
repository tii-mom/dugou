import { getRequestContext } from '@cloudflare/next-on-pages'
import { verifyTelegramHash } from '@/lib/auth-server'

export const runtime = 'edge'

type D1Query = {
  bind: (...values: unknown[]) => {
    first: () => Promise<Record<string, string> | null>
    run: () => Promise<unknown>
  }
}

type AuthEnv = {
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_INITDATA_MAX_AGE_SECONDS?: string | number
  DB?: {
    prepare: (query: string) => D1Query
  }
}

type TelegramInitUser = {
  id?: string | number
  username?: string
  first_name?: string
  last_name?: string
  photo_url?: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { initData?: string }
    const initData = body.initData || ''

    let context
    try {
      context = getRequestContext()
    } catch {}
    const env = (context?.env || {}) as CloudflareEnv as AuthEnv
    const botToken = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ''
    const maxAgeSecs = Number(
      env.TELEGRAM_INITDATA_MAX_AGE_SECONDS ||
        process.env.TELEGRAM_INITDATA_MAX_AGE_SECONDS ||
        86400
    )

    // Determine environment. If DB binding is present, we treat it as an active Cloudflare platform.
    const isProd = process.env.NODE_ENV === 'production' || Boolean(env.DB)

    if (!botToken) {
      console.warn('TELEGRAM_BOT_TOKEN is not configured. Telegram login is disabled.')
      if (isProd) {
        return new Response(
          JSON.stringify({ error: 'Telegram Bot Token is not configured. Running in browser fallback.' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      } else {
        return handleGuestSession()
      }
    }

    const isValid = await verifyTelegramHash(initData, botToken)
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid Telegram signature.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const params = new URLSearchParams(initData)
    const authDate = Number(params.get('auth_date') || 0)
    const now = Math.floor(Date.now() / 1000)
    if (now - authDate > maxAgeSecs) {
      return new Response(JSON.stringify({ error: 'Init data has expired.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const userStr = params.get('user') || '{}'
    const tgUser = JSON.parse(userStr) as TelegramInitUser
    const telegramId = String(tgUser.id || '')
    if (!telegramId) {
      return new Response(JSON.stringify({ error: 'Missing user ID in Telegram initData.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const username = tgUser.username || ''
    const firstName = tgUser.first_name || ''
    const lastName = tgUser.last_name || ''
    const photoUrl = tgUser.photo_url || ''

    const db = env.DB
    if (!db) {
      return handleGuestSession()
    }

    const user = await db
      .prepare('SELECT * FROM users WHERE telegram_id = ?')
      .bind(telegramId)
      .first()

    const nowIso = new Date().toISOString()
    let userId = ''

    if (!user) {
      userId = crypto.randomUUID()
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      const startParam = params.get('start_param') || ''
      let invitedByUserId = null

      if (startParam) {
        const inviter = await db
          .prepare('SELECT id FROM users WHERE invite_code = ?')
          .bind(startParam)
          .first()
        if (inviter) {
          invitedByUserId = inviter.id
        }
      }

      await db
        .prepare(
          'INSERT INTO users (id, telegram_id, telegram_username, telegram_first_name, telegram_last_name, photo_url, invite_code, invited_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          userId,
          telegramId,
          username,
          firstName,
          lastName,
          photoUrl,
          inviteCode,
          invitedByUserId,
          nowIso,
          nowIso
        )
        .run()

      await db
        .prepare(
          'INSERT INTO wallet_balances (user_id, locked_g_balance, unlocked_g_balance, total_deposited_usdt, streak_days, updated_at) VALUES (?, 0, 0, 0, 0, ?)'
        )
        .bind(userId, nowIso)
        .run()

      if (invitedByUserId) {
        await db
          .prepare(
            'INSERT INTO invites (id, inviter_user_id, invitee_user_id, invite_code, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind(crypto.randomUUID(), invitedByUserId, userId, startParam, 'pending', nowIso)
          .run()
      }
    } else {
      userId = user.id
      await db
        .prepare(
          'UPDATE users SET telegram_username = ?, telegram_first_name = ?, telegram_last_name = ?, photo_url = ?, updated_at = ? WHERE id = ?'
        )
        .bind(username, firstName, lastName, photoUrl, nowIso, userId)
        .run()
    }

    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
    await db
      .prepare(
        'INSERT INTO sessions (id, user_id, telegram_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(sessionId, userId, telegramId, nowIso, expiresAt)
      .run()

    const cookie = `session_id=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
    return new Response(
      JSON.stringify({
        user: {
          id: userId,
          telegramId,
          username,
        },
        session: {
          expiresAt,
        },
        source: 'api',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie,
        },
      }
    )
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function handleGuestSession() {
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
  const sessionId = 'mock-session-id'
  // Secure flag omitted for local non-https development testing
  const cookie = `session_id=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`
  return new Response(
    JSON.stringify({
      user: {
        id: 'mock-user-id',
        telegramId: '999999',
        username: 'guest_user',
      },
      session: {
        expiresAt,
      },
      source: 'demo',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookie,
      },
    }
  )
}
