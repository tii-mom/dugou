import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'
import { getVestingData, getUserPackages, getDiaoBalance } from '@/lib/ton-chain-client'
import { DIAO_TOKENOMICS } from '@/lib/ton-config'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    let context
    try { context = getRequestContext() } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB

    let userId: string | null = null
    if (db) {
      const user = await getSessionUser(request, db)
      if (user) userId = user.id
    }

    // Default configuration values
    let currentPrice: number = DIAO_TOKENOMICS.initialPriceUsd
    let currentRound = 0
    let totalSoldPackages = 0
    let totalWallets = 0

    // Source indicators
    let vestingSource: 'chain' | 'local_cache' | 'unavailable' = 'unavailable'
    let diaoBalanceSource: 'chain' | 'local_estimate' | 'unavailable' = 'unavailable'
    let chainDataFreshAt = ''

    // Read config settings from DB
    if (db) {
      const priceRow = await db.prepare("SELECT value FROM app_config WHERE key = 'g_price'").first()
      if (priceRow?.value) currentPrice = Number(priceRow.value)

      const roundRow = await db.prepare("SELECT value FROM app_config WHERE key = 'diao_current_round'").first()
      if (roundRow?.value) currentRound = Number(roundRow.value)

      const soldRow = await db.prepare("SELECT COALESCE(SUM(package_count),0) as total FROM diao_purchases WHERE status = 'confirmed'").first()
      if (soldRow?.total) totalSoldPackages = Number(soldRow.total)

      const walletsRow = await db.prepare("SELECT COUNT(DISTINCT wallet_address) as cnt FROM diao_purchases WHERE status = 'confirmed'").first()
      if (walletsRow?.cnt) totalWallets = Number(walletsRow.cnt)

      vestingSource = 'local_cache'
    }

    // Try fetching real-time Vesting Controller variables on-chain
    const vesting = await getVestingData(env)
    if (vesting) {
      currentRound = vesting.currentUnlockedRound
      totalSoldPackages = vesting.totalPackagesSold
      vestingSource = 'chain'
      chainDataFreshAt = new Date().toISOString()
    }

    const nextUnlockPrice = Number((DIAO_TOKENOMICS.initialPriceUsd * Math.pow(2, currentRound + 1)).toFixed(5))
    const circulatingSupply = DIAO_TOKENOMICS.initialCirculation + totalSoldPackages * DIAO_TOKENOMICS.immediatePerPackage
    const lockedSupply = DIAO_TOKENOMICS.lockedSupply - totalSoldPackages * DIAO_TOKENOMICS.immediatePerPackage

    // User-specific variables
    let lossUsd = 0
    let lossStatus = 'not_submitted'
    let walletAddress = ''
    let purchasedPackages = 0
    let immediateDiao = 0
    let lockedDiao = 0
    let highestClaimedRound = 0
    let diaoBalance = 0
    let claimedDiao = 0
    let claimableDiao = 0

    if (db && userId) {
      // 1. Loss Claim
      const lossRow = await db.prepare(
        "SELECT amount_usd, status FROM loss_claims WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
      ).bind(userId).first()
      if (lossRow) {
        lossStatus = String(lossRow.status)
        if (lossRow.amount_usd) lossUsd = Number(lossRow.amount_usd) / 100
      }

      // 2. Local database cache details
      const purchaseRow = await db.prepare(
        "SELECT COALESCE(SUM(package_count),0) as total_packages, COALESCE(SUM(immediate_diao),0) as immediate, COALESCE(SUM(locked_diao),0) as locked, COALESCE(MAX(highest_claimed_round),0) as max_claimed FROM diao_purchases WHERE user_id = ? AND status = 'confirmed'"
      ).bind(userId).first()
      if (purchaseRow) {
        purchasedPackages = Number(purchaseRow.total_packages)
        immediateDiao = Number(purchaseRow.immediate)
        lockedDiao = Number(purchaseRow.locked)
        highestClaimedRound = Number(purchaseRow.max_claimed)
      }

      const walletRow = await db.prepare(
        "SELECT wallet_address FROM diao_purchases WHERE user_id = ? AND status = 'confirmed' LIMIT 1"
      ).bind(userId).first()
      if (walletRow?.wallet_address) {
        walletAddress = String(walletRow.wallet_address)
      }
    }

    // Try fetching user details on-chain if wallet exists
    if (walletAddress) {
      const userPkgs = await getUserPackages(env, walletAddress)
      if (userPkgs) {
        purchasedPackages = userPkgs.packageCount
        highestClaimedRound = userPkgs.highestClaimedRound
      }

      const balanceNano = await getDiaoBalance(env, walletAddress)
      if (balanceNano !== BigInt(0)) {
        diaoBalance = Number(balanceNano / BigInt(1e9))
        diaoBalanceSource = 'chain'
      }
    }

    // Fallback: estimate balance locally if chain is unavailable
    if (diaoBalanceSource === 'unavailable') {
      claimedDiao = highestClaimedRound * purchasedPackages * DIAO_TOKENOMICS.releasePerRound
      diaoBalance = immediateDiao + claimedDiao
      diaoBalanceSource = 'local_estimate'
    } else {
      // Chain balance is successful, compute claimed/claimable on-chain
      claimedDiao = highestClaimedRound * purchasedPackages * DIAO_TOKENOMICS.releasePerRound
    }

    claimableDiao = Math.max(0, (currentRound - highestClaimedRound) * purchasedPackages * DIAO_TOKENOMICS.releasePerRound)

    const flipTargetUsd = lossUsd
    const requiredDiaoAtRound18 = flipTargetUsd > 0 ? Math.ceil(flipTargetUsd / DIAO_TOKENOMICS.round18PriceUsd) : 0
    const holdingValueUsd = diaoBalance * currentPrice
    const progressPercent = flipTargetUsd > 0 ? Math.min(100, (holdingValueUsd / flipTargetUsd) * 100) : 0

    return new Response(JSON.stringify({
      lossUsd,
      flipTargetUsd,
      requiredDiaoAtRound18,
      walletAddress,
      diaoBalance,
      purchasedPackages,
      immediateDiao,
      lockedDiao,
      claimableDiao,
      claimedDiao,
      currentRound,
      currentDiaoPrice: currentPrice,
      nextUnlockPrice,
      progressPercent,
      holdingValueUsd,
      totalSoldPackages,
      circulatingSupply,
      lockedSupply,
      totalWallets,
      lossStatus,
      vestingSource,
      diaoBalanceSource,
      chainDataFreshAt,
      highestClaimedRound,
    }), {
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
