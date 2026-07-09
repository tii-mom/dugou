import {
  type Badge,
  type Believer,
  type LossLeaderboardRow,
  type SpeedLeaderboardRow,
  type TeamMember,
  type TeamTitle,
} from '@/lib/business-types'

// Demo-only content. These values are safe for storytelling surfaces, but must
// be replaced by API-backed data before being presented as real user activity.
export const tickerMessages = [
  '【演示】来自 Binance 的用户，此刻刚刚加入了春天计划',
  '【演示】来自 OKX 的用户刚刚完成一次进度加成',
  '【演示】一位 Bybit 用户的进度条越过了 80% 警戒线',
  '【演示】来自 Bitget 的用户刚刚点亮了「归乡者」称谓',
  '【演示】一支 Binance 队伍集体进度突破 60%',
  '【演示】一位 OKX 支持者为「春天守望队」点亮了一盏灯',
  '【演示】来自 Hyperliquid 的用户刚刚提交了亏损记录',
  '【演示】今日已有 1,204 条前端体验记录',
]

export const DEMO_TEAM_MEMBERS: TeamMember[] = [
  { id: 'm1', name: '老K', role: 'father', progress: 0.92, lit: true, source: 'demo' },
  { id: 'm2', name: '阿豪', role: 'pup', progress: 0.78, lit: true, source: 'demo' },
  { id: 'm3', name: '夜航者', role: 'pup', progress: 0.64, lit: true, source: 'demo' },
  { id: 'm4', name: '半仓哥', role: 'pup', progress: 0.41, lit: false, source: 'demo' },
  { id: 'm5', name: '小刀', role: 'pup', progress: 0.33, lit: false, source: 'demo' },
  { id: 'm6', name: '夜盯侠', role: 'pup', progress: 0.18, lit: false, source: 'demo' },
]

export const DEMO_BELIEVERS: Believer[] = [
  { id: 'b1', name: '守林人', source: 'demo' },
  { id: 'b2', name: '点灯者', source: 'demo' },
]

export const DEMO_TEAM_TITLES: TeamTitle[] = [
  { name: '幸存者', threshold: 0.25, unlocked: true, source: 'demo' },
  { name: '重启者', threshold: 0.5, unlocked: true, source: 'demo' },
  { name: '归乡者', threshold: 0.75, unlocked: false, source: 'demo' },
  { name: '命运的主人', threshold: 1, unlocked: false, source: 'demo' },
]

export const DEMO_BADGES: Badge[] = [
  { name: '首次记录', rarity: '普通', desc: '完成首次体验记录', owned: true, source: 'demo' },
  { name: '七日不灭', rarity: '普通', desc: '连续记录 7 天', owned: true, source: 'demo' },
  { name: '加成体质', rarity: '稀有', desc: '触发一次演示进度加成', owned: true, source: 'demo' },
  { name: '深渊归来', rarity: '稀有', desc: '亏损超过 5,000 U 仍坚持 30 天', owned: false, source: 'demo' },
  { name: '首季幸存者', rarity: '传说', desc: '第一赛季限定 · 过季不可再获得', owned: false, source: 'demo' },
  { name: '命运的主人', rarity: '传说', desc: '自身解锁且半数队友归乡', owned: false, source: 'demo' },
]

export const DEMO_LOSS_LEADERBOARD: LossLeaderboardRow[] = [
  { rank: 1, name: 'Binance 用户', amount: 218400, source: 'demo' },
  { rank: 2, name: 'OKX 用户', amount: 156200, source: 'demo' },
  { rank: 3, name: 'Bybit 用户', amount: 98750, source: 'demo' },
  { rank: 4, name: 'Bitget 用户', amount: 67300, source: 'demo' },
  { rank: 5, name: 'Hyperliquid 用户', amount: 45120, source: 'demo' },
]

export const DEMO_SPEED_LEADERBOARD: SpeedLeaderboardRow[] = [
  { rank: 1, name: 'OKX 用户', days: 34, source: 'demo' },
  { rank: 2, name: 'Binance 用户', days: 41, source: 'demo' },
  { rank: 3, name: 'Gate 用户', days: 55, source: 'demo' },
  { rank: 4, name: 'Bitget 用户', days: 62, source: 'demo' },
  { rank: 5, name: 'Bybit 用户', days: 78, source: 'demo' },
]

export const DEMO_INVITE_LINES = [
  '你的春天还没来吗，进来抱团取暖',
  '这里的人比你更惨，但都在往上爬',
  '一个人扛不动的数字，一支队伍一起扛',
]

export const teamMembers = DEMO_TEAM_MEMBERS
export const believers = DEMO_BELIEVERS
export const teamTitles = DEMO_TEAM_TITLES
export const badges = DEMO_BADGES
export const lossLeaderboard = DEMO_LOSS_LEADERBOARD
export const speedLeaderboard = DEMO_SPEED_LEADERBOARD
export const inviteLines = DEMO_INVITE_LINES
