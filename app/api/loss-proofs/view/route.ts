import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    const urlObj = new URL(request.url)
    const key = urlObj.searchParams.get('key') || ''

    if (!key) {
      return new Response('Missing object key.', { status: 400 })
    }

    let context
    try {
      context = getRequestContext()
    } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB
    const r2 = env.LOSS_PROOFS

    if (!db || !r2) {
      // Local dev fallback: Return 1x1 transparent PNG
      return new Response(
        Uint8Array.of(
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
          0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
          0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78,
          0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
          0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
        ),
        { headers: { 'Content-Type': 'image/png' } }
      )
    }

    const user = await getSessionUser(request, db)
    if (!user) {
      return new Response('Unauthorized.', { status: 401 })
    }

    const claim = await db
      .prepare('SELECT * FROM loss_claims WHERE r2_object_key = ? AND user_id = ?')
      .bind(key, user.id)
      .first()
    if (!claim) {
      return new Response('Access denied or claim not found.', { status: 403 })
    }

    const obj = await r2.get(key)
    if (!obj) {
      return new Response('Image object not found in storage.', { status: 404 })
    }

    const buffer = await obj.arrayBuffer()
    const contentType = claim.file_mime || 'image/png'

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch (e: unknown) {
    return new Response(`Error: ${e instanceof Error ? e.message : String(e)}`, { status: 500 })
  }
}
