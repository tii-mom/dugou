export async function verifyTelegramHash(initData: string, botToken: string): Promise<boolean> {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return false

  const keys = Array.from(params.keys()).filter((k) => k !== 'hash').sort()
  const dataCheckString = keys.map((k) => `${k}=${params.get(k)}`).join('\n')

  const encoder = new TextEncoder()
  const webAppDataKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const secretKeyBuffer = await crypto.subtle.sign(
    'HMAC',
    webAppDataKey,
    encoder.encode(botToken)
  )

  const secretKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    encoder.encode(dataCheckString)
  )

  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return signature === hash
}

type QueryBinder = {
  bind: (...values: unknown[]) => {
    first: () => Promise<Record<string, string> | null>
  }
}

type SessionDatabase = {
  prepare: (query: string) => QueryBinder
}

export async function getSessionUser(request: Request, db: SessionDatabase | null | undefined) {
  if (!db) return null

  const cookieHeader = request.headers.get('Cookie') || ''
  const cookies = parseCookies(cookieHeader)
  const sessionId = cookies['session_id']

  if (!sessionId) return null

  try {
    const session = await db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .bind(sessionId)
      .first()

    if (!session) return null

    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return null
    }

    const user = await db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(session.user_id)
      .first()

    return user || null
  } catch (e) {
    console.error('Session verification error:', e)
    return null
  }
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {}
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=')
    if (parts.length >= 2) {
      list[parts[0].trim()] = parts.slice(1).join('=').trim()
    }
  })
  return list
}
