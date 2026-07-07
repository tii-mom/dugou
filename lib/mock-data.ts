export const tickerMessages = [
  '来自广州的一位兄弟，此刻刚刚加入了春天计划',
  '深圳的匿名幸存者刚刚触发了 7.2 倍暴击',
  '一位杭州用户的进度条越过了 80% 警戒线',
  '来自成都的狗仔刚刚点亮了「归乡者」称谓',
  '北京的一支狗队集体进度突破 60%',
  '上海的一位信徒为「回本敢死队」点亮了一盏灯',
  '重庆的一位兄弟刚刚上传了他的伤疤',
  '全网今日已有 1,204 位春天使者完成存入',
]

export type Member = {
  id: string
  name: string
  role: 'father' | 'pup'
  progress: number
  lit: boolean
}

export const teamMembers: Member[] = [
  { id: 'm1', name: '老K', role: 'father', progress: 0.92, lit: true },
  { id: 'm2', name: '阿豪', role: 'pup', progress: 0.78, lit: true },
  { id: 'm3', name: '梭哈王', role: 'pup', progress: 0.64, lit: true },
  { id: 'm4', name: '半仓哥', role: 'pup', progress: 0.41, lit: false },
  { id: 'm5', name: '小刀', role: 'pup', progress: 0.33, lit: false },
  { id: 'm6', name: '夜盯侠', role: 'pup', progress: 0.18, lit: false },
]

export const believers = [
  { id: 'b1', name: '守林人' },
  { id: 'b2', name: '点灯者' },
]

export type TeamTitle = {
  name: string
  threshold: number
  unlocked: boolean
}

export const teamTitles: TeamTitle[] = [
  { name: '幸存者', threshold: 0.25, unlocked: true },
  { name: '回血人', threshold: 0.5, unlocked: true },
  { name: '归乡者', threshold: 0.75, unlocked: false },
  { name: '命运的主人', threshold: 1, unlocked: false },
]

export type Badge = {
  name: string
  rarity: '普通' | '稀有' | '传说'
  desc: string
  owned: boolean
}

export const badges: Badge[] = [
  { name: '第一滴血', rarity: '普通', desc: '完成首次存入', owned: true },
  { name: '七日不灭', rarity: '普通', desc: '连续存入 7 天', owned: true },
  { name: '暴击体质', rarity: '稀有', desc: '触发一次 5 倍以上暴击', owned: true },
  { name: '深渊归来', rarity: '稀有', desc: '亏损超过 5,000 U 仍坚持 30 天', owned: false },
  { name: '首季幸存者', rarity: '传说', desc: '第一赛季限定 · 过季不可再获得', owned: false },
  { name: '命运的主人', rarity: '传说', desc: '自身解锁且半数队友归乡', owned: false },
]

export const lossLeaderboard = [
  { rank: 1, name: '匿名·上海', amount: 218400 },
  { rank: 2, name: '匿名·深圳', amount: 156200 },
  { rank: 3, name: '匿名·杭州', amount: 98750 },
  { rank: 4, name: '匿名·成都', amount: 67300 },
  { rank: 5, name: '匿名·广州', amount: 45120 },
]

export const speedLeaderboard = [
  { rank: 1, name: '匿名·北京', days: 34 },
  { rank: 2, name: '匿名·武汉', days: 41 },
  { rank: 3, name: '匿名·南京', days: 55 },
  { rank: 4, name: '匿名·西安', days: 62 },
  { rank: 5, name: '匿名·重庆', days: 78 },
]

export const inviteLines = [
  '你的春天还没来吗，进来抱团取暖',
  '这里的人比你更惨，但都在往上爬',
  '一个人扛不动的数字，一群狗一起扛',
]
