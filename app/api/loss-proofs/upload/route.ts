import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'
import { isRateLimited } from '@/lib/rate-limit'

export const runtime = 'edge'

export async function PUT(request: Request) {
  try {
    const urlObj = new URL(request.url)
    const key = urlObj.searchParams.get('key') || ''

    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing object key.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let context
    try {
      context = getRequestContext()
    } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB
    
    // Rate limit check
    if (await isRateLimited(request, db, { route: '/api/loss-proofs/upload', limit: 10 })) {
      return new Response(JSON.stringify({ error: 'Too many requests.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const r2 = env.LOSS_PROOFS
    const isProd = process.env.NODE_ENV === 'production' || Boolean(db)

    if (!r2 && isProd) {
      return new Response(JSON.stringify({ error: 'R2 bucket is not configured. Server refuses uploads in production.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let userId = 'mock-user-id'
    let claim: {
      id: string
      user_id: string
      file_mime: string
      file_size: number
      status: string
      expires_at: string | null
    } | null = null

    if (db) {
      const user = await getSessionUser(request, db)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      userId = user.id

      claim = await db
        .prepare('SELECT * FROM loss_claims WHERE r2_object_key = ? AND user_id = ?')
        .bind(key, userId)
        .first()

      if (!claim) {
        return new Response(
          JSON.stringify({ error: 'Claim record not found or access denied.' }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // 1. Verify claim status is not already submitted for review
      if (claim.status !== 'not_submitted' && claim.status !== 'uploaded') {
        return new Response(
          JSON.stringify({ error: 'Claim has already been submitted or is under review.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // 2. Verify claim expiration
      if (claim.expires_at && new Date(claim.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Upload url has expired.' }),
          {
            status: 410,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // 3. Verify Content-Type matches registered file mime
      const reqContentType = request.headers.get('Content-Type') || ''
      if (claim.file_mime && reqContentType.toLowerCase() !== claim.file_mime.toLowerCase()) {
        return new Response(
          JSON.stringify({ error: `MIME type mismatch. Expected ${claim.file_mime}` }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      // 4. Verify Content-Length headers bounds
      const contentLength = Number(request.headers.get('Content-Length') || 0)
      if (claim.file_size && (contentLength > claim.file_size || contentLength > 8 * 1024 * 1024)) {
        return new Response(
          JSON.stringify({ error: 'Content size exceeds registered limits.' }),
          {
            status: 413,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    }

    const bodyBuffer = await request.arrayBuffer()

    if (db && claim) {
      // Secondary check on actual payload size
      if (claim.file_size && (bodyBuffer.byteLength > claim.file_size || bodyBuffer.byteLength > 8 * 1024 * 1024)) {
        return new Response(
          JSON.stringify({ error: 'Byte payload exceeds registered limits.' }),
          {
            status: 413,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    }

    if (r2) {
      await r2.put(key, bodyBuffer)
    } else {
      console.log(`[LOCAL DEV] Mocked R2 upload for key: ${key}`)
    }

    if (db && claim) {
      await db
        .prepare('UPDATE loss_claims SET status = ?, updated_at = ? WHERE id = ?')
        .bind('uploaded', new Date().toISOString(), claim.id)
        .run()
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
