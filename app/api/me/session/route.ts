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

    // Default Fallback Session Data
    const fallbackResponse = {
      lossClaim: {
        status: 'not_submitted',
        amountUsd: null,
        certificateNo: null,
        message: '尚未提交真实亏损证明。当前使用演示初始状态。',
        source: 'demo',
      },
      lockedGBalance: 0,
      streakDays: 0,
      diaoPriceUsd: 0.042,
      diaoHighestPriceUsd: 0.042,
    }

    if (!db) {
      return new Response(JSON.stringify(fallbackResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const user = await getSessionUser(request, db)
    if (!user) {
      // Return guest session matching contract requirements
      return new Response(JSON.stringify(fallbackResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Retrieve Wallet Balance
    let balance = await db
      .prepare('SELECT * FROM wallet_balances WHERE user_id = ?')
      .bind(user.id)
      .first()
    if (!balance) {
      // Auto-initialize balance row
      const nowIso = new Date().toISOString()
      await db
        .prepare(
          'INSERT INTO wallet_balances (user_id, locked_g_balance, unlocked_g_balance, total_deposited_usdt, streak_days, updated_at) VALUES (?, 0, 0, 0, 0, ?)'
        )
        .bind(user.id, nowIso)
        .run()
      balance = { locked_g_balance: 0, unlocked_g_balance: 0, streak_days: 0 }
    }

    // Retrieve Latest Claim
    const claim = await db
      .prepare('SELECT * FROM loss_claims WHERE user_id = ? AND status != ? ORDER BY created_at DESC LIMIT 1')
      .bind(user.id, 'not_submitted')
      .first()

    const displayAmountUsd = claim && claim.amount_usd !== null ? Math.floor(claim.amount_usd / 100) : null
    const lossClaim = claim
      ? {
          status: claim.status,
          amountUsd: displayAmountUsd,
          certificateNo: claim.certificate_no,
          exchange: claim.exchange || 'Unknown',
          confidence: claim.amount_confidence || 0,
          fileName: claim.original_file_name,
          message: claim.review_status_reason || '已提交截图，正在等待风控审核确认。',
          source: 'api',
        }
      : {
          status: 'not_submitted',
          amountUsd: null,
          certificateNo: null,
          message: '尚未提交真实亏损证明。',
          source: 'api',
        }

    // Retrieve DIAO Token Price configs
    let gPrice = 0.042
    let gHighestPrice = 0.042

    const priceConfig = await db.prepare('SELECT * FROM app_config WHERE key = ?').bind('g_price').first()
    if (priceConfig) {
      gPrice = Number(priceConfig.value)
    }
    const highestPriceConfig = await db.prepare('SELECT * FROM app_config WHERE key = ?').bind('g_highest_price').first()
    if (highestPriceConfig) {
      gHighestPrice = Number(highestPriceConfig.value)
    }

    return new Response(
      JSON.stringify({
        lossClaim,
        lockedGBalance: balance.locked_g_balance,
        streakDays: balance.streak_days,
        diaoPriceUsd: gPrice,
        diaoHighestPriceUsd: gHighestPrice,
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
