import { getRequestContext } from '@cloudflare/next-on-pages'
import { verifyAdminReviewToken } from '@/lib/admin-auth'
import { isRateLimited } from '@/lib/rate-limit'

export const runtime = 'edge'

function text(message: string, status: number) {
  return new Response(message, { status })
}

function getEnv() {
  let context
  try {
    context = getRequestContext()
  } catch {}
  return (context?.env || {}) as CloudflareEnv
}

export async function GET(request: Request) {
  const env = getEnv()
  if (await isRateLimited(request, env.DB, { route: '/api/admin/loss-claims/image', limit: 30 })) {
    return text('Too many requests.', 429)
  }
  if (!(await verifyAdminReviewToken(request, env))) {
    return text('Unauthorized.', 401)
  }

  if (!env.DB || !env.LOSS_PROOFS) {
    return text('DB or R2 binding is not configured.', 503)
  }

  const url = new URL(request.url)
  const key = url.searchParams.get('key') || ''
  if (!key) return text('Missing object key.', 400)

  const claim = await env.DB
    .prepare('SELECT r2_object_key, file_mime FROM loss_claims WHERE r2_object_key = ?')
    .bind(key)
    .first<{ r2_object_key: string; file_mime: string | null }>()

  if (!claim) return text('Claim not found.', 404)

  const obj = await env.LOSS_PROOFS.get(key)
  if (!obj) return text('Image object not found in storage.', 404)

  return new Response(await obj.arrayBuffer(), {
    status: 200,
    headers: {
      'Content-Type': claim.file_mime || 'image/png',
      'Cache-Control': 'private, no-store',
    },
  })
}
