import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'

export const runtime = 'edge'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      unlockedGBalance?: number
    }
    const unlockedGBalance = body.unlockedGBalance || 0

    if (unlockedGBalance <= 0) {
      return new Response(JSON.stringify({ error: 'Unlocked DIAO amount must be positive.' }), {
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
      return new Response(
        JSON.stringify({
          status: 'unavailable',
          message: '本地开发接口未接入数据库：审核解锁申请暂时不可用。',
          source: 'demo',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const user = await getSessionUser(request, db)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const nowIso = new Date().toISOString()
    const requestId = crypto.randomUUID()

    // Save audit request in D1 database
    await db
      .prepare(
        `INSERT INTO withdraw_requests (id, user_id, unlocked_g_amount, status, destination_type, destination_address, message, created_at, updated_at)
         VALUES (?, ?, ?, 'requested', 'Wallet', '', ?, ?, ?)`
      )
      .bind(requestId, user.id, unlockedGBalance, `提现申请审核中，数量: ${unlockedGBalance} DIAO`, nowIso, nowIso)
      .run()

    return new Response(
      JSON.stringify({
        status: 'pending',
        message: `解锁审核申请已成功提交（共 ${unlockedGBalance} DIAO）。根据春天计划合规细则，所有审核提现均为人工排队复核与支付发放，不支持即时到账，感谢配合！`,
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
