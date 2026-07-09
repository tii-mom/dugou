import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      usdtAmount?: number
      diaoPriceUsd?: number
      isTrial?: boolean
    }
    const { usdtAmount = 0, diaoPriceUsd = 0.042, isTrial = false } = body

    if (usdtAmount <= 0) {
      return new Response(JSON.stringify({ error: 'USDT amount must be positive.' }), {
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

    // Handle Trial/Demo Mode
    if (isTrial) {
      const base = Math.round(usdtAmount / diaoPriceUsd)
      return new Response(
        JSON.stringify({
          base,
          gained: base,
          multiplier: 1.0,
          crit: false,
          status: 'demo_recorded',
          message: '试玩模式已按 1:1 生成演示记录，不产生真实 DIAO 资产。',
          source: 'demo',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Handle Live Mode
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

    const baseAmount = Math.round(usdtAmount / diaoPriceUsd)
    const nowIso = new Date().toISOString()
    const eventId = crypto.randomUUID()

    if (db) {
      // Record a pending payment settlement event in the database.
      // Amounts are converted to cents for storage.
      await db
        .prepare(
          `INSERT INTO deposit_events (id, user_id, usdt_amount, g_price_usd, base_g_amount, gained_g_amount, multiplier, crit, status, source, created_at)
           VALUES (?, ?, ?, ?, ?, 0, 1.0, 0, ?, ?, ?)`
        )
        .bind(eventId, userId, Math.round(usdtAmount * 100), diaoPriceUsd, baseAmount, 'pending_settlement', 'api', nowIso)
        .run()
    }

    return new Response(
      JSON.stringify({
        base: baseAmount,
        gained: 0, // No real balance added until confirmed by off-chain verification
        multiplier: 1.0,
        crit: false,
        status: 'pending_settlement',
        message: '真实入账渠道尚未配置或确认，本次充值申请处于挂起中 (pending_settlement)。',
        source: 'api',
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
