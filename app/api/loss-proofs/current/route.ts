import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    let context
    try {
      context = getRequestContext()
    } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB

    if (!db) {
      return new Response(
        JSON.stringify({
          lossClaim: {
            status: 'not_submitted',
            amountUsd: null,
            certificateNo: null,
            message: '尚未提交亏损证明。',
            source: 'demo',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const user = await getSessionUser(request, db)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const claim = await db
      .prepare('SELECT * FROM loss_claims WHERE user_id = ? AND status != ? ORDER BY created_at DESC LIMIT 1')
      .bind(user.id, 'not_submitted')
      .first()

    if (!claim) {
      return new Response(
        JSON.stringify({
          lossClaim: {
            status: 'not_submitted',
            amountUsd: null,
            certificateNo: null,
            message: '尚未提交亏损证明。',
            source: 'api',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const displayAmountUsd = claim.amount_usd !== null ? Math.floor(claim.amount_usd / 100) : null

    return new Response(
      JSON.stringify({
        lossClaim: {
          status: claim.status,
          amountUsd: displayAmountUsd,
          certificateNo: claim.certificate_no,
          exchange: claim.exchange,
          confidence: claim.amount_confidence,
          fileName: claim.original_file_name,
          message: claim.review_status_reason || '截图已提交，等待审核确认。',
          source: 'api',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
