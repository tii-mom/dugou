import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'

export const runtime = 'edge'

type RequestBody = {
  intentId?: unknown
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

    const intentId = typeof body.intentId === 'string' ? body.intentId.trim() : ''
    const txBoc = typeof body.tx_boc === 'string' ? body.tx_boc.trim() : ''

    if (!intentId) {
      return new Response(JSON.stringify({ error: 'intentId is required.' }), {
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
    const isProd = process.env.NODE_ENV === 'production'

    if (!db) {
      if (isProd) {
        return new Response(JSON.stringify({ error: 'D1 DB binding is not configured. Server refuses mock purchase broadcast in production.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ success: true, message: 'Demo mode local mock broadcast.' }), {
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

    const intent = await db.prepare(
      "SELECT id, status FROM diao_sale_intents WHERE id = ? AND user_id = ?"
    ).bind(intentId, user.id).first()

    if (!intent) {
      return new Response(JSON.stringify({ error: 'Intent not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const allowedStatuses = new Set([
      'pending_wallet_signature',
      'broadcasted',
      'pending_chain_confirmation',
    ])

    if (!allowedStatuses.has(String(intent.status))) {
      return new Response(JSON.stringify({
        error: 'Invalid state transition.',
        status: intent.status,
        message: '该购买意向当前状态不能重新广播。',
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const nowIso = new Date().toISOString()
    await db.prepare(
      `UPDATE diao_sale_intents
       SET status = 'pending_chain_confirmation', tx_boc = ?, updated_at = ?
       WHERE id = ?`
    ).bind(txBoc, nowIso, intentId).run()

    return new Response(JSON.stringify({
      success: true,
      status: 'pending_chain_confirmation',
      message: '交易已广播，等待链上确认。'
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
