import { getRequestContext } from '@cloudflare/next-on-pages'
import { verifyAdminReviewToken } from '@/lib/admin-auth'
import { isRateLimited } from '@/lib/rate-limit'

export const runtime = 'edge'

type SocialTaskRow = {
  id: string
  user_id: string
  platform: string
  task_type: string
  submitted_url: string
  submitted_url_normalized: string
  platform_post_id: string | null
  fetched_title: string | null
  fetched_text: string | null
  fetched_screenshot_key: string | null
  fetch_status: string
  fetch_error: string | null
  hard_rule_status: string
  hard_rule_reason: string | null
  ai_provider: string | null
  ai_model: string | null
  ai_result_json: string | null
  ai_suggested_status: string | null
  status: string
  review_status_reason: string | null
  reward_status: string
  reviewed_at: string | null
  reviewed_by: string | null
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
  if (await isRateLimited(request, env.DB, { route: '/api/admin/social-tasks', limit: 30 })) {
    return json({ error: 'Too many requests.' }, 429)
  }
  if (!(await verifyAdminReviewToken(request, env))) {
    return json({ error: 'Unauthorized.' }, 401)
  }

  const db = env.DB
  if (!db) {
    return json({ error: 'D1 DB binding is not configured.' }, 503)
  }

  const url = new URL(request.url)
  const id = url.searchParams.get('id')

  // Support single item GET detail
  if (id) {
    const record = await db
      .prepare('SELECT * FROM social_task_submissions WHERE id = ?')
      .bind(id)
      .first<SocialTaskRow>()

    if (!record) {
      return json({ error: 'Social task submission not found.' }, 404)
    }

    return json({ submission: record })
  }

  // List GET review items
  const status = url.searchParams.get('status') || 'pending_review'
  const limit = normalizeLimit(url.searchParams.get('limit'))

  const allowedStatuses = new Set(['pending_review', 'verified', 'rejected', 'ai_passed', 'all'])
  if (!allowedStatuses.has(status)) {
    return json({ error: 'Invalid status filter.' }, 400)
  }

  let result
  if (status === 'all') {
    result = await db
      .prepare('SELECT * FROM social_task_submissions ORDER BY created_at DESC LIMIT ?')
      .bind(limit)
      .all<SocialTaskRow>()
  } else {
    result = await db
      .prepare('SELECT * FROM social_task_submissions WHERE status = ? ORDER BY created_at ASC LIMIT ?')
      .bind(status, limit)
      .all<SocialTaskRow>()
  }

  return json({ submissions: result.results || [] })
}

export async function PATCH(request: Request) {
  const env = getEnv()
  if (await isRateLimited(request, env.DB, { route: '/api/admin/social-tasks', limit: 30 })) {
    return json({ error: 'Too many requests.' }, 429)
  }
  if (!(await verifyAdminReviewToken(request, env))) {
    return json({ error: 'Unauthorized.' }, 401)
  }

  const db = env.DB
  if (!db) {
    return json({ error: 'D1 DB binding is not configured.' }, 503)
  }

  let body: {
    id?: unknown
    status?: unknown
    reason?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return json({ error: 'Invalid JSON request body.' }, 400)
  }

  const id = String(body.id || '').trim()
  const status = String(body.status || '').trim()
  const reason = String(body.reason || 'Approved by administrator.').trim()

  if (!id || !status) {
    return json({ error: 'Missing required fields: id and status are mandatory.' }, 400)
  }

  const allowedTargetStatuses = new Set(['verified', 'rejected'])
  if (!allowedTargetStatuses.has(status)) {
    return json({ error: 'Invalid target status. Only verified or rejected are allowed.' }, 400)
  }

  // Load record
  const record = await db
    .prepare('SELECT * FROM social_task_submissions WHERE id = ?')
    .bind(id)
    .first<SocialTaskRow>()

  if (!record) {
    return json({ error: 'Social task submission not found.' }, 404)
  }

  // Strictly block duplicate reviews
  if (record.status !== 'pending_review') {
    return json({ error: `Conflict: This task is already reviewed and has status '${record.status}'.` }, 409)
  }

  const nowIso = new Date().toISOString()

  // Update status only, no reward issuance
  await db
    .prepare(
      `UPDATE social_task_submissions 
       SET status = ?, review_status_reason = ?, reviewed_at = ?, reviewed_by = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(status, reason, nowIso, 'admin', nowIso, id)
    .run()

  return json({
    submission: {
      id,
      status,
      reviewStatusReason: reason,
      reviewedAt: nowIso,
      reviewedBy: 'admin',
    },
  })
}
