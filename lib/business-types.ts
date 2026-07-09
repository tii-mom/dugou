export type DataMode = 'demo' | 'api'

export type LossProofStatus = 'not_submitted' | 'pending_review' | 'verified' | 'rejected' | 'demo_estimate'

export type ExchangeSource =
  | 'Binance'
  | 'OKX'
  | 'Bybit'
  | 'Bitget'
  | 'Gate'
  | 'Hyperliquid'
  | 'Other'
  | 'Unknown'

export type LossClaim = {
  status: LossProofStatus
  amountUsd: number | null
  certificateNo: string | null
  exchange?: ExchangeSource
  confidence?: number
  fileName?: string
  message: string
  source: DataMode
}

export type UserSessionSnapshot = {
  lossClaim: LossClaim
  lockedGBalance: number
  streakDays: number
  diaoPriceUsd: number
  diaoHighestPriceUsd: number
}

export type DepositReceipt = {
  base: number
  gained: number
  multiplier: number
  crit: boolean
  status: 'demo_recorded' | 'pending_settlement'
  message: string
  source: DataMode
}

export type ClaimRequestResult = {
  status: 'unavailable' | 'pending'
  message: string
  source: DataMode
}

export type TeamMember = {
  id: string
  name: string
  role: 'father' | 'pup'
  progress: number
  lit: boolean
  source: DataMode
}

export type Believer = {
  id: string
  name: string
  source: DataMode
}

export type TeamTitle = {
  name: string
  threshold: number
  unlocked: boolean
  source: DataMode
}

export type Badge = {
  name: string
  rarity: '普通' | '稀有' | '传说'
  desc: string
  owned: boolean
  source: DataMode
}

export type LossLeaderboardRow = {
  rank: number
  name: string
  exchange?: ExchangeSource
  amount: number
  source: DataMode
}

export type SpeedLeaderboardRow = {
  rank: number
  name: string
  exchange?: ExchangeSource
  days: number
  source: DataMode
}

export type CommunitySnapshot = {
  mode: DataMode
  teamProgress: number
  bossTotalLossUsd: number
  bossTargetUsd: number
  members: TeamMember[]
  believers: Believer[]
  titles: TeamTitle[]
  inviteLines: string[]
}

export type HonorSnapshot = {
  mode: DataMode
  badges: Badge[]
  lossLeaderboard: LossLeaderboardRow[]
  speedLeaderboard: SpeedLeaderboardRow[]
  wheelPrizes: string[]
}

export type TokenSaleRound = {
  round: number
  unlockPriceUsd: number
  multipleFromInitial: number
  amountDIAO: number
  destination: 'participants' | 'team'
}

export type TokenSalePackage = {
  tonPrice: number
  contractGasBufferTon: number
  immediateDIAO: number
  lockedDIAO: number
  releaseRounds: number
  perRoundDIAO: number
  maxPackagesPerWallet: number
  maxPackagesTotal: number
}

export type TokenSaleIntent = {
  intentId: string
  walletAddress: string
  packages: number
  totalTon: number
  contractGasBufferTon: number
  contractRequiredTon: number
  immediateDIAO: number
  lockedDIAO: number
  perRoundDIAO: number
  status: 'pending_contract_payment'
  message: string
  source: DataMode
}

// --- New types for battlefield integration ---

export type TxStatus = 'idle' | 'pending_sign' | 'broadcasted' | 'confirming' | 'confirmed' | 'failed'

export type PurchaseRecord = {
  id: string
  txHash: string
  packageCount: number
  paidTon: number
  immediateDiao: number
  lockedDiao: number
  totalDiao: number
  highestClaimedRound: number
  status: 'confirmed' | 'failed'
  createdAt: string
}

export type BattlefieldData = {
  lossUsd: number
  flipTargetUsd: number
  requiredDiaoAtRound18: number
  walletAddress: string
  diaoBalance: number
  purchasedPackages: number
  immediateDiao: number
  lockedDiao: number
  claimableDiao: number
  claimedDiao: number
  currentRound: number
  currentDiaoPrice: number
  nextUnlockPrice: number
  progressPercent: number
  holdingValueUsd: number
  totalSoldPackages: number
  circulatingSupply: number
  lockedSupply: number
  totalWallets: number
  lossStatus: LossProofStatus
  vestingSource?: 'chain' | 'local_cache' | 'unavailable'
  diaoBalanceSource?: 'chain' | 'local_estimate' | 'unavailable'
  chainDataFreshAt?: string
  highestClaimedRound?: number
}
