import { D1Database, R2Bucket } from '@cloudflare/workers-types'

declare global {
  interface CloudflareEnv {
    DB: D1Database
    LOSS_PROOFS: R2Bucket
    AI: { run: (model: string, input: unknown) => Promise<unknown> }
    TELEGRAM_BOT_TOKEN?: string
    TELEGRAM_BOT_USERNAME?: string
    TELEGRAM_INITDATA_MAX_AGE_SECONDS?: string
    ADMIN_REVIEW_TOKEN?: string
    CLOUDFLARE_AI_MODEL?: string
    AGNES_AI_BASE_URL?: string
    AGNES_AI_API_KEY?: string
    AGNES_AI_MODEL?: string
    AGNES_AI_VISION_MODEL?: string
    AGNES_AI_TASK_VERIFY_MODEL?: string
    NEXT_PUBLIC_OKX_INVITE_URL?: string
    NEXT_PUBLIC_BINANCE_INVITE_URL?: string
    DIAO_SALE_TON_RECEIVER?: string
    DIAO_TEAM_WALLET?: string
    DIAO_MINTER_ADDRESS?: string
    DIAO_VESTING_ADDRESS?: string
    DIAO_JETTON_WALLET_CODE_HASH?: string
    DIAO_METADATA_URL?: string
    DIAO_MAINNET_DEPLOYER_WALLET?: string
    DIAO_INITIAL_CIRCULATION_WALLET?: string
    DIAO_OFFICIAL_RESERVE_WALLET?: string
    DIAO_TREASURY_WALLET?: string
    DIAO_EMERGENCY_RESCUE_WALLET?: string
    DIAO_ADMIN_WALLET?: string
    DIAO_PRICE_ADMIN_WALLET?: string
  }
}
