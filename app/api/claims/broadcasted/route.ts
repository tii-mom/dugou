import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'

export const runtime = 'edge'

type RequestBody = {
  claimId?: unknown
  tx_boc?: unknown
}

export async function POST(request: Request) {
  try {
    let body: RequestBody
    try {
      body = (await request.json()) as RequestBody
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const claimId = typeof body.claimId === 'string' ? body.claimId.trim() : ''
    const txBoc = typeof body.tx_boc === 'string' ? body.tx_boc.trim() : ''

    if (!claimId) {
      return new Response(JSON.stringify({ error: 'claimId is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (!txBoc) {
      return new Response(JSON.stringify({ error: 'tx_boc is required.' }), {
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

    if (!db) {
      return new Response(JSON.stringify({ success: true, message: 'Demo mode mock claim broadcast.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const user = await getSessionUser(request, db)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const claim = await db.prepare(
      "SELECT id, status FROM diao_claims WHERE id = ? AND user_id = ?"
    ).bind(claimId, user.id).first()

    if (!claim) {
      return new Response(JSON.stringify({ error: 'Claim not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const allowedStatuses = new Set([
      'pending_wallet_signature',
      'broadcasted',
      'pending_chain_confirmation',
    ])

    if (!allowedStatuses.has(String(claim.status))) {
      return new Response(JSON.stringify({
        error: 'Invalid state transition.',
        status: claim.status,
        message: '该领取申请当前状态不能重新广播。',
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const nowIso = new Date().toISOString()
    await db.prepare(
      `UPDATE diao_claims
       SET status = 'pending_chain_confirmation', tx_boc = ?, updated_at = ?
       WHERE id = ?`
    ).bind(txBoc, nowIso, claimId).run()

    return new Response(JSON.stringify({
      success: true,
      status: 'pending_chain_confirmation',
      message: '领取申请已广播，等待链上确认。'
    }), {
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
