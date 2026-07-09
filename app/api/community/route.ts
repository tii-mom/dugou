import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'

export const runtime = 'edge'

// Fallback demo data matching mock-data.ts definitions
const DEMO_TEAM_MEMBERS = [
  { id: 'm1', name: '老K', role: 'father', progress: 0.92, lit: true, source: 'demo' },
  { id: 'm2', name: '阿豪', role: 'pup', progress: 0.78, lit: true, source: 'demo' },
  { id: 'm3', name: '夜航者', role: 'pup', progress: 0.64, lit: true, source: 'demo' },
  { id: 'm4', name: '半仓哥', role: 'pup', progress: 0.41, lit: false, source: 'demo' },
  { id: 'm5', name: '小刀', role: 'pup', progress: 0.33, lit: false, source: 'demo' },
  { id: 'm6', name: '夜盯侠', role: 'pup', progress: 0.18, lit: false, source: 'demo' },
]

const DEMO_BELIEVERS = [
  { id: 'b1', name: '守林人', source: 'demo' },
  { id: 'b2', name: '点灯者', source: 'demo' },
]

const DEMO_TEAM_TITLES = [
  { name: '幸存者', threshold: 0.25, unlocked: true, source: 'demo' },
  { name: '重启者', threshold: 0.5, unlocked: true, source: 'demo' },
  { name: '归乡者', threshold: 0.75, unlocked: false, source: 'demo' },
  { name: '命运的主人', threshold: 1, unlocked: false, source: 'demo' },
]

const DEMO_INVITE_LINES = [
  '你的春天还没来吗，进来抱团取暖',
  '这里的人比你更惨，但都在往上爬',
  '一个人扛不动的数字，一支队伍一起扛',
]

export async function GET(request: Request) {
  try {
    let context
    try {
      context = getRequestContext()
    } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB

    // Default response using demo mode
    const responseData = {
      mode: 'demo',
      teamProgress: 0.54,
      bossTotalLossUsd: 128406772,
      bossTargetUsd: 500000000,
      members: DEMO_TEAM_MEMBERS,
      believers: DEMO_BELIEVERS,
      titles: DEMO_TEAM_TITLES,
      inviteLines: DEMO_INVITE_LINES,
    }

    if (!db) {
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const user = await getSessionUser(request, db)
    if (!user) {
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Optional: Query user's real team if D1 schema has them configured.
    // If not found, return demo snapshot to avoid empty pages.
    return new Response(JSON.stringify(responseData), {
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
