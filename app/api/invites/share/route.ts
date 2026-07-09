import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    let context
    try {
      context = getRequestContext()
    } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB

    // Read general environment configs
    const botUsername = env.TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || 'DIAOBot'
    const okxInviteUrl = env.NEXT_PUBLIC_OKX_INVITE_URL || process.env.NEXT_PUBLIC_OKX_INVITE_URL || ''
    const binanceInviteUrl = env.NEXT_PUBLIC_BINANCE_INVITE_URL || process.env.NEXT_PUBLIC_BINANCE_INVITE_URL || ''

    const defaultResponse = {
      inviteCode: 'DEMOCD',
      inviteUrl: `https://t.me/${botUsername}?startapp=DEMOCD`,
      shareText: '我的春天计划还没来，进来抱团取暖，一起爬出深渊！',
      okxInviteUrl,
      binanceInviteUrl,
    }

    if (!db) {
      return new Response(JSON.stringify(defaultResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const user = await getSessionUser(request, db)
    if (!user) {
      return new Response(JSON.stringify(defaultResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const inviteCode = user.invite_code || 'DEMOCD'
    const inviteUrl = `https://t.me/${botUsername}?startapp=${inviteCode}`

    return new Response(
      JSON.stringify({
        inviteCode,
        inviteUrl,
        shareText: `我的亏损春天计划专属通道！用我的码【${inviteCode}】进来抱团取暖，一起赢回未来！`,
        okxInviteUrl,
        binanceInviteUrl,
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
