import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'
import { getUserPackages } from '@/lib/ton-chain-client'
import { DIAO_TOKENOMICS } from '@/lib/ton-config'

export const runtime = 'edge'

export async function GET(request: Request) {
  try {
    let context
    try { context = getRequestContext() } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB

    if (!db) {
      return new Response(JSON.stringify({ purchases: [], currentRound: 0, totalPackages: 0, totalClaimable: 0, totalClaimed: 0, chainMismatch: false }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    const user = await getSessionUser(request, db)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      })
    }

    const roundRow = await db.prepare("SELECT value FROM app_config WHERE key = 'diao_current_round'").first()
    const currentRound = roundRow?.value ? Number(roundRow.value) : 0

    const rows = await db.prepare(
      "SELECT id, tx_hash, wallet_address, package_count, paid_ton, immediate_diao, locked_diao, total_diao, highest_claimed_round, status, created_at FROM diao_purchases WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(user.id).all()

    let totalPackages = 0
    let totalClaimable = 0
    let totalClaimed = 0
    let lastWalletAddress = ''

    const purchases = (rows.results || []).map((row: Record<string, unknown>) => {
      const pkgCount = Number(row.package_count)
      const highClaimed = Number(row.highest_claimed_round)
      const claimable = row.status === 'confirmed'
        ? Math.max(0, (currentRound - highClaimed) * pkgCount * DIAO_TOKENOMICS.releasePerRound)
        : 0
      const claimed = highClaimed * pkgCount * DIAO_TOKENOMICS.releasePerRound

      if (row.status === 'confirmed') {
        totalPackages += pkgCount
        totalClaimable += claimable
        totalClaimed += claimed
        if (row.wallet_address) lastWalletAddress = String(row.wallet_address)
      }

      return {
        id: row.id,
        txHash: row.tx_hash,
        walletAddress: row.wallet_address,
        packageCount: pkgCount,
        paidTon: Number(row.paid_ton),
        immediateDiao: Number(row.immediate_diao),
        lockedDiao: Number(row.locked_diao),
        totalDiao: Number(row.total_diao),
        highestClaimedRound: highClaimed,
        claimable,
        claimed,
        status: row.status,
        createdAt: row.created_at,
      }
    })

    // Read chain info if user has purchased packages and we have a wallet
    let chainMismatch = false
    let chainPackages = 0
    let chainHighestClaimed = 0

    if (lastWalletAddress) {
      const chainData = await getUserPackages(env, lastWalletAddress)
      if (chainData) {
        chainPackages = chainData.packageCount
        chainHighestClaimed = chainData.highestClaimedRound

        const localHighestClaimed = (rows.results || [])
          .filter((row: Record<string, unknown>) => row.status === 'confirmed')
          .reduce((max: number, row: Record<string, unknown>) => Math.max(max, Number(row.highest_claimed_round)), 0)

        if (chainPackages !== totalPackages || chainHighestClaimed !== localHighestClaimed) {
          chainMismatch = true
        }
      }
    }

    return new Response(JSON.stringify({
      purchases,
      currentRound,
      totalPackages,
      totalClaimable,
      totalClaimed,
      chainMismatch,
      chainDetails: chainMismatch ? {
        chainPackages,
        localPackages: totalPackages,
        chainHighestClaimed,
        localHighestClaimed: (rows.results || [])
          .filter((row: Record<string, unknown>) => row.status === 'confirmed')
          .reduce((max: number, row: Record<string, unknown>) => Math.max(max, Number(row.highest_claimed_round)), 0)
      } : null
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}
