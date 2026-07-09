import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fileName?: string
      mimeType?: string
      fileSize?: number
    }
    const { fileName, mimeType, fileSize } = body

    if (!fileName || !mimeType || !fileSize) {
      return new Response(JSON.stringify({ error: 'Missing required parameters.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (fileSize > 8 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File size exceeds 8MB limit.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowedMimes.includes(mimeType.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Only PNG, JPEG, and WebP are allowed.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    let context
    try {
      context = getRequestContext()
    } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB

    let userId = 'mock-user-id'
    if (db) {
      const user = await getSessionUser(request, db)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      userId = user.id
    }

    const ext = fileName.split('.').pop() || 'png'
    const uuid = crypto.randomUUID()
    const dateStr = new Date().toISOString().split('T')[0]
    const objectKey = `claims/${userId}/${dateStr}_${uuid}.${ext}`
    const nowIso = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour expiry

    if (db) {
      await db
        .prepare(
          'INSERT INTO loss_claims (id, user_id, r2_object_key, original_file_name, file_mime, file_size, status, source, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(uuid, userId, objectKey, fileName, mimeType, fileSize, 'not_submitted', 'api', expiresAt, nowIso, nowIso)
        .run()
    }

    const urlObj = new URL(request.url)
    const uploadUrl = `${urlObj.origin}/api/loss-proofs/upload?key=${encodeURIComponent(
      objectKey
    )}`

    return new Response(
      JSON.stringify({
        uploadUrl,
        objectKey,
        expiresAt,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
