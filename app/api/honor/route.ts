import { getRequestContext } from '@cloudflare/next-on-pages'
import { type Badge, type DataMode, type LossLeaderboardRow, type SpeedLeaderboardRow } from '@/lib/business-types'

export const runtime = 'edge'

type LeaderboardSnapshot = {
  payload_json: string
}

type HonorEnv = {
  DB?: {
    prepare: (query: string) => {
      bind: (...values: unknown[]) => {
        first: () => Promise<LeaderboardSnapshot | null>
      }
    }
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

const DEMO_BADGES: Badge[] = [
  { name: '首次记录', rarity: '普通', desc: '完成首次体验记录', owned: true, source: 'demo' },
  { name: '七日不灭', rarity: '普通', desc: '连续记录 7 天', owned: true, source: 'demo' },
  { name: '加成体质', rarity: '稀有', desc: '触发一次进度加成', owned: true, source: 'demo' },
  {
    name: '深渊归来',
    rarity: '稀有',
    desc: '亏损超过 5,000 U 仍坚持 30 天',
    owned: false,
    source: 'demo',
  },
  { name: '首季幸存者', rarity: '传说', desc: '第一赛季限定 · 过季不可再获得', owned: false, source: 'demo' },
  { name: '命运的主人', rarity: '传说', desc: '自身解锁且半数队友归乡', owned: false, source: 'demo' },
]

const DEMO_LOSS_LEADERBOARD: LossLeaderboardRow[] = [
  { rank: 1, name: 'Binance 用户', amount: 218400, source: 'demo' },
  { rank: 2, name: 'OKX 用户', amount: 156200, source: 'demo' },
  { rank: 3, name: 'Bybit 用户', amount: 98750, source: 'demo' },
  { rank: 4, name: 'Bitget 用户', amount: 67300, source: 'demo' },
  { rank: 5, name: 'Hyperliquid 用户', amount: 45120, source: 'demo' },
]

const DEMO_SPEED_LEADERBOARD: SpeedLeaderboardRow[] = [
  { rank: 1, name: 'OKX 用户', days: 34, source: 'demo' },
  { rank: 2, name: 'Binance 用户', days: 41, source: 'demo' },
  { rank: 3, name: 'Gate 用户', days: 55, source: 'demo' },
  { rank: 4, name: 'Bitget 用户', days: 62, source: 'demo' },
  { rank: 5, name: 'Bybit 用户', days: 78, source: 'demo' },
]

const DEMO_WHEEL_PRIZES = [
  '+88 DIAO（演示）',
  '连胜保护卡（演示）',
  '+12 DIAO（演示）',
  '稀有头像框（演示）',
  '+520 DIAO（演示）',
  '再接再厉',
]

export async function GET() {
  try {
    let context
    try {
      context = getRequestContext()
    } catch {}

    const env = (context?.env || {}) as HonorEnv
    const db = env.DB

    const responseData = {
      mode: 'demo' as DataMode,
      badges: DEMO_BADGES,
      lossLeaderboard: DEMO_LOSS_LEADERBOARD,
      speedLeaderboard: DEMO_SPEED_LEADERBOARD,
      wheelPrizes: DEMO_WHEEL_PRIZES,
    }

    if (!db) {
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Try to load snapshot from DB if they exist
    const lossSnapshot = await db
      .prepare('SELECT payload_json FROM leaderboard_snapshots WHERE board = ? ORDER BY created_at DESC LIMIT 1')
      .bind('loss')
      .first()
    if (lossSnapshot) {
      responseData.lossLeaderboard = JSON.parse(lossSnapshot.payload_json)
      responseData.mode = 'api'
    }

    const speedSnapshot = await db
      .prepare('SELECT payload_json FROM leaderboard_snapshots WHERE board = ? ORDER BY created_at DESC LIMIT 1')
      .bind('speed')
      .first()
    if (speedSnapshot) {
      responseData.speedLeaderboard = JSON.parse(speedSnapshot.payload_json)
      responseData.mode = 'api'
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: getErrorMessage(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
