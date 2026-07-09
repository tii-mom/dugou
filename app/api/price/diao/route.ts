import { getRequestContext } from '@cloudflare/next-on-pages'
import { DIAO_TOKENOMICS } from '@/lib/ton-config'

export const runtime = 'edge'

export async function GET() {
  try {
    let context
    try { context = getRequestContext() } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB

    let price = 0.042 // Default for compatibility testing
    let currentRound = 0
    let totalSoldPackages = 0
    let configuredAt = new Date().toISOString()

    if (db) {
      const priceRow = await db.prepare("SELECT value, updated_at FROM app_config WHERE key = 'g_price'").first()
      if (priceRow?.value) {
        price = Number(priceRow.value)
        if (priceRow.updated_at) configuredAt = String(priceRow.updated_at)
      }

      const roundRow = await db.prepare("SELECT value FROM app_config WHERE key = 'diao_current_round'").first()
      if (roundRow?.value) currentRound = Number(roundRow.value)

      const soldRow = await db.prepare("SELECT COALESCE(SUM(package_count),0) as total FROM diao_purchases WHERE status = 'confirmed'").first()
      if (soldRow?.total) totalSoldPackages = Number(soldRow.total)
    }

    const nextUnlockPrice = Number((price * 2).toFixed(5))

    return new Response(JSON.stringify({
      priceUsd: price, // compatibility
      source: 'configured',
      configuredAt,
      price,
      current_round: currentRound,
      next_unlock_price: nextUnlockPrice,
      round18_price: DIAO_TOKENOMICS.round18PriceUsd,
      total_sold_packages: totalSoldPackages,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
