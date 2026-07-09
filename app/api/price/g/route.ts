import { getRequestContext } from '@cloudflare/next-on-pages'

export const runtime = 'edge'

export async function GET() {
  try {
    let context
    try {
      context = getRequestContext()
    } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB

    let gPrice = 0.042
    let configuredAt = new Date().toISOString()

    if (db) {
      const priceConfig = await db.prepare('SELECT * FROM app_config WHERE key = ?').bind('g_price').first()
      if (priceConfig) {
        gPrice = Number(priceConfig.value)
        configuredAt = priceConfig.updated_at
      }
    }

    return new Response(
      JSON.stringify({
        priceUsd: gPrice,
        source: 'configured',
        configuredAt,
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
