import { getRequestContext } from '@cloudflare/next-on-pages'
import { verifyAdminReviewToken } from '@/lib/admin-auth'

export const runtime = 'edge'

type LossClaimRow = {
  id: string
  user_id: string
  r2_object_key: string | null
  original_file_name: string | null
  file_mime: string | null
  file_size: number | null
  status: string
  amount_usd: number | null
  exchange: string | null
  amount_confidence: number | null
  review_status_reason: string | null
  created_at: string
  updated_at: string
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getEnv() {
  let context
  try {
    context = getRequestContext()
  } catch {}
  return (context?.env || {}) as CloudflareEnv
}

function normalizeLimit(value: string | null) {
  const parsed = Number(value || 50)
  if (!Number.isFinite(parsed)) return 50
  return Math.max(1, Math.min(100, Math.floor(parsed)))
}

export async function GET(request: Request) {
  const env = getEnv()
  if (!(await verifyAdminReviewToken(request, env))) {
    return json({ error: 'Unauthorized.' }, 401)
  }

  if (!env.DB) return json({ error: 'D1 DB binding is not configured.' }, 503)

  const url = new URL(request.url)
  const status = url.searchParams.get('status') || 'pending_review'
  const limit = normalizeLimit(url.searchParams.get('limit'))

  const allowedStatuses = new Set(['pending_review', 'verified', 'rejected', 'uploaded', 'not_submitted'])
  if (!allowedStatuses.has(status)) {
    return json({ error: 'Invalid status filter.' }, 400)
  }

  const result = await env.DB
    .prepare(
      `SELECT
        id,
        user_id,
        r2_object_key,
        original_file_name,
        file_mime,
        file_size,
        status,
        amount_usd,
        exchange,
        amount_confidence,
        review_status_reason,
        created_at,
        updated_at
       FROM loss_claims
       WHERE status = ?
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .bind(status, limit)
    .all<LossClaimRow>()

  const origin = url.origin
  const claims = ((result.results as LossClaimRow[]) || []).map((claim: LossClaimRow) => ({
    id: claim.id,
    userId: claim.user_id,
    objectKey: claim.r2_object_key,
    imageUrl: claim.r2_object_key
      ? `${origin}/api/admin/loss-claims/image?key=${encodeURIComponent(claim.r2_object_key)}`
      : null,
    originalFileName: claim.original_file_name,
    fileMime: claim.file_mime,
    fileSize: claim.file_size,
    status: claim.status,
    amountUsd: claim.amount_usd !== null ? Math.floor(claim.amount_usd / 100) : null,
    amountUsdCents: claim.amount_usd,
    exchange: claim.exchange,
    amountConfidence: claim.amount_confidence,
    reviewStatusReason: claim.review_status_reason,
    createdAt: claim.created_at,
    updatedAt: claim.updated_at,
  }))

  return json({ claims })
}

export async function PATCH(request: Request) {
  const env = getEnv()
  if (!(await verifyAdminReviewToken(request, env))) {
    return json({ error: 'Unauthorized.' }, 401)
  }

  if (!env.DB) return json({ error: 'D1 DB binding is not configured.' }, 503)

  let body: {
    id?: unknown
    status?: unknown
    amountUsd?: unknown
    exchange?: unknown
    reason?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const status = typeof body.status === 'string' ? body.status.trim() : ''
  const exchange = typeof body.exchange === 'string' ? body.exchange.trim() : 'Unknown'
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

  if (!id) return json({ error: 'id is required.' }, 400)
  if (status !== 'verified' && status !== 'rejected') {
    return json({ error: 'status must be verified or rejected.' }, 400)
  }

  const existing = await env.DB
    .prepare('SELECT id, status FROM loss_claims WHERE id = ?')
    .bind(id)
    .first<{ id: string; status: string }>()

  if (!existing) return json({ error: 'Claim not found.' }, 404)
  if (existing.status !== 'pending_review') {
    return json({ error: `Claim is ${existing.status}, only pending_review can be reviewed.` }, 409)
  }

  const nowIso = new Date().toISOString()

  if (status === 'verified') {
    const amountUsd = Number(body.amountUsd)
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return json({ error: 'amountUsd must be a positive USD number for verification.' }, 400)
    }

    const amountUsdCents = Math.round(amountUsd * 100)
    await env.DB
      .prepare(
        `UPDATE loss_claims
         SET status = ?,
             amount_usd = ?,
             exchange = ?,
             amount_confidence = 1,
             review_status_reason = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(status, amountUsdCents, exchange || 'Unknown', reason || '人工审核通过。', nowIso, id)
      .run()
  } else {
    await env.DB
      .prepare(
        `UPDATE loss_claims
         SET status = ?,
             review_status_reason = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(status, reason || '人工审核未通过，请重新上传清晰亏损截图。', nowIso, id)
      .run()
  }

  const updated = await env.DB
    .prepare('SELECT id, status, amount_usd, exchange, review_status_reason, updated_at FROM loss_claims WHERE id = ?')
    .bind(id)
    .first()

  return json({ claim: updated })
}
