import {
  type ClaimRequestResult,
  type CommunitySnapshot,
  type DepositReceipt,
  type HonorSnapshot,
  type LossClaim,
  type UserSessionSnapshot,
} from '@/lib/business-types'
import { apiRequest, isApiAdapterEnabled } from '@/lib/api-client'
import {
  DEMO_BADGES,
  DEMO_BELIEVERS,
  DEMO_INVITE_LINES,
  DEMO_LOSS_LEADERBOARD,
  DEMO_SPEED_LEADERBOARD,
  DEMO_TEAM_MEMBERS,
  DEMO_TEAM_TITLES,
} from '@/lib/mock-data'

export type LossProofFile = {
  name: string
  size: number
  type: string
  arrayBuffer?: () => Promise<ArrayBuffer>
}

export type DepositInput = {
  usdtAmount: number
  diaoPriceUsd: number
  isTrial: boolean
}

export type ClaimInput = {
  unlockedGBalance: number
}

export type BusinessService = {
  getInitialSession: () => UserSessionSnapshot
  getTrialSession: () => UserSessionSnapshot
  submitLossProof: (file: LossProofFile) => Promise<LossClaim>
  createDepositReceipt: (input: DepositInput) => DepositReceipt
  requestUnlockedClaim: (input: ClaimInput) => ClaimRequestResult
  getCommunitySnapshot: () => CommunitySnapshot
  getHonorSnapshot: () => HonorSnapshot
  getWheelPrize: (attempt: number) => string
  updateCommunityCache?: (data: Partial<CommunitySnapshot>) => void
  updateHonorCache?: (data: Partial<HonorSnapshot>) => void
}

type SubmitLossProofResponse = {
  lossClaim: LossClaim
}

const EMPTY_LOSS_CLAIM: LossClaim = {
  status: 'not_submitted',
  amountUsd: null,
  certificateNo: null,
  exchange: 'Unknown',
  message: '尚未提交亏损证明。接入后端后由审核/风控服务返回真实金额。',
  source: 'demo',
}

const PENDING_LOSS_CLAIM = (file: LossProofFile): LossClaim => ({
  status: 'pending_review',
  amountUsd: null,
  certificateNo: null,
  exchange: 'Unknown',
  confidence: 0,
  fileName: file.name,
  message: '亏损截图已提交，等待后端 OCR/人工审核确认；当前不生成真实审核金额。',
  source: 'demo',
})

export const demoBusinessService: BusinessService = {
  getInitialSession: () => ({
    lossClaim: EMPTY_LOSS_CLAIM,
    lockedGBalance: 0,
    streakDays: 0,
    diaoPriceUsd: 0.042,
    diaoHighestPriceUsd: 0.042,
  }),

  getTrialSession: () => ({
    lossClaim: {
      status: 'demo_estimate',
      amountUsd: 1000,
      certificateNo: 'DEMO-TRIAL',
      exchange: 'Binance',
      confidence: 1,
      message: '试玩模式额度，仅用于演示流程，不代表真实亏损审核结果。',
      source: 'demo',
    },
    lockedGBalance: 2000,
    streakDays: 1,
    diaoPriceUsd: 0.042,
    diaoHighestPriceUsd: 0.042,
  }),

  submitLossProof: async (file) => PENDING_LOSS_CLAIM(file),

  createDepositReceipt: ({ usdtAmount, diaoPriceUsd, isTrial }) => {
    const base = Math.round(usdtAmount / diaoPriceUsd)
    const gained = isTrial ? base : 0

    return {
      base,
      gained,
      multiplier: isTrial ? 1 : 0,
      crit: false,
      status: isTrial ? 'demo_recorded' : 'pending_settlement',
      source: 'demo',
      message: isTrial
        ? '试玩模式已按 1:1 生成演示记录，不产生真实 DIAO 资产。'
        : '真实记录结算接口未接入，当前不会变更链上或钱包余额。',
    }
  },

  requestUnlockedClaim: ({ unlockedGBalance }) => ({
    status: 'unavailable',
    source: 'demo',
    message:
      unlockedGBalance > 0
        ? '人工审核接口尚未接入：可申请数量仅为前端展示值，不能生成真实转账。'
        : '暂无达到审核条件的记录数量。',
  }),

  getCommunitySnapshot: () => ({
    mode: 'demo',
    teamProgress: 0.54,
    bossTotalLossUsd: 128406772,
    bossTargetUsd: 500000000,
    members: DEMO_TEAM_MEMBERS,
    believers: DEMO_BELIEVERS,
    titles: DEMO_TEAM_TITLES,
    inviteLines: DEMO_INVITE_LINES,
  }),

  getHonorSnapshot: () => ({
    mode: 'demo',
    badges: DEMO_BADGES,
    lossLeaderboard: DEMO_LOSS_LEADERBOARD,
    speedLeaderboard: DEMO_SPEED_LEADERBOARD,
    wheelPrizes: ['+88 DIAO（演示）', '连胜保护卡（演示）', '+12 DIAO（演示）', '稀有头像框（演示）', '+520 DIAO（演示）', '再接再厉'],
  }),

  getWheelPrize: (attempt) => {
    const prizes = demoBusinessService.getHonorSnapshot().wheelPrizes
    return prizes[attempt % prizes.length]
  },
}

// Global references for Proxy/Mutable caching of Community and Honor snapshots
const globalCommunitySnapshot: CommunitySnapshot = {
  mode: 'demo',
  teamProgress: 0.54,
  bossTotalLossUsd: 128406772,
  bossTargetUsd: 500000000,
  members: DEMO_TEAM_MEMBERS,
  believers: DEMO_BELIEVERS,
  titles: DEMO_TEAM_TITLES,
  inviteLines: DEMO_INVITE_LINES,
}

const globalHonorSnapshot: HonorSnapshot = {
  mode: 'demo',
  badges: DEMO_BADGES,
  lossLeaderboard: DEMO_LOSS_LEADERBOARD,
  speedLeaderboard: DEMO_SPEED_LEADERBOARD,
  wheelPrizes: ['+88 DIAO（演示）', '连胜保护卡（演示）', '+12 DIAO（演示）', '稀有头像框（演示）', '+520 DIAO（演示）', '再接再厉'],
}

export function createApiBusinessService(fallback: BusinessService = demoBusinessService): BusinessService {
  return {
    getInitialSession: () => {
      const session = fallback.getInitialSession()
      return {
        ...session,
        lossClaim: {
          ...session.lossClaim,
          message: 'API 会话将在后端接口接入后加载；当前使用演示初始状态。',
        },
      }
    },

    getTrialSession: () => fallback.getTrialSession(),

    async submitLossProof(file) {
      // 1. Get proxy upload URL and objectKey
      const resUrl = await apiRequest<{ uploadUrl: string; objectKey: string }>(
        '/api/loss-proofs/upload-url',
        {
          method: 'POST',
          body: {
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
          },
        }
      )

      if (!resUrl.ok) {
        const claim = await fallback.submitLossProof(file)
        return {
          ...claim,
          message: `获取上传通道失败: ${resUrl.error}。已暂存本地为待审核。`,
        }
      }

      const { uploadUrl, objectKey } = resUrl.data

      // Read file content
      let fileBuffer: ArrayBuffer
      try {
        if (typeof file.arrayBuffer === 'function') {
          fileBuffer = await file.arrayBuffer()
        } else {
          throw new Error('当前文件对象不支持读取内容。')
        }
      } catch (err: unknown) {
        return {
          ...(await fallback.submitLossProof(file)),
          message: `本地文件读取错误: ${err instanceof Error ? err.message : String(err)}。`,
        }
      }

      // 2. PUT upload via backend proxy
      try {
        const resUpload = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
          },
          body: fileBuffer,
        })
        if (!resUpload.ok) {
          const text = await resUpload.text()
          return {
            ...(await fallback.submitLossProof(file)),
            message: `文件传输失败: ${resUpload.status} ${text}。已暂存本地。`,
          }
        }
      } catch (uploadErr: unknown) {
        return {
          ...(await fallback.submitLossProof(file)),
          message: `网络上传异常: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}。已暂存本地。`,
        }
      }

      // 3. Submit for D1 record updates and OCR suggestions
      const resSubmit = await apiRequest<SubmitLossProofResponse>('/api/loss-proofs/submit', {
        method: 'POST',
        body: {
          objectKey,
          originalFileName: file.name,
        },
      })

      if (resSubmit.ok) {
        return resSubmit.data.lossClaim
      }

      const claim = await fallback.submitLossProof(file)
      return {
        ...claim,
        message: `后端注册失败: ${resSubmit.error}。已暂存本地。`,
      }
    },

    createDepositReceipt: (input) => {
      if (!input.isTrial) {
        // Asynchronously report deposit checkpoint without blocking the synchronous return
        apiRequest('/api/deposits/check', {
          method: 'POST',
          body: {
            usdtAmount: input.usdtAmount,
            diaoPriceUsd: input.diaoPriceUsd,
            isTrial: false,
          },
        }).catch((err) => console.error('Background deposit check error:', err))
      }

      const base = Math.round(input.usdtAmount / input.diaoPriceUsd)
      return {
        base,
        gained: input.isTrial ? base : 0,
        multiplier: input.isTrial ? 1 : 1.0,
        crit: false,
        status: input.isTrial ? 'demo_recorded' : 'pending_settlement',
        source: 'api',
        message: input.isTrial
          ? '试玩模式已按 1:1 生成演示记录，不产生真实 DIAO 资产。'
          : '真实记录申请已上报挂起中 (pending_settlement)，等待风控结算确认。',
      }
    },

    requestUnlockedClaim: (input) => {
      // Asynchronously submit unlocked withdrawal requests to DB
      apiRequest('/api/claims/unlocked', {
        method: 'POST',
        body: {
          unlockedGBalance: input.unlockedGBalance,
        },
      }).catch((err) => console.error('Background claim unlocked error:', err))

      return {
        status: 'pending',
        source: 'api',
        message: `已提交解锁审核申请（数量：${input.unlockedGBalance} DIAO）。由于涉及安全合规，当前仅记录为人工审核工单，审核通过后由管理员人工处理发币，并非即时到账。`,
      }
    },

    getCommunitySnapshot: () => globalCommunitySnapshot,

    getHonorSnapshot: () => globalHonorSnapshot,

    getWheelPrize: (attempt) => fallback.getWheelPrize(attempt),

    updateCommunityCache: (data) => {
      if (data) {
        Object.assign(globalCommunitySnapshot, data)
      }
    },

    updateHonorCache: (data) => {
      if (data) {
        Object.assign(globalHonorSnapshot, data)
      }
    },
  }
}

export function getBusinessService(): BusinessService {
  if (isApiAdapterEnabled()) return createApiBusinessService()
  return demoBusinessService
}
