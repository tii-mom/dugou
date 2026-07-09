import { getRequestContext } from '@cloudflare/next-on-pages'
import { Address } from '@ton/core'
import { getSessionUser } from '@/lib/auth-server'
import { isRateLimited } from '@/lib/rate-limit'
import { getUserPackages, getVestingData } from '@/lib/ton-chain-client'
import { buildClaimBuyerPayload } from '@/lib/ton-payload'
import { DIAO_CONTRACTS, DIAO_TOKENOMICS } from '@/lib/ton-config'

export const runtime = 'edge'

type RequestBody = {
  walletAddress?: unknown
}

function generateSecureQueryId(): string {
  const randomBytes = new Uint8Array(8)
  crypto.getRandomValues(randomBytes)
  const dataView = new DataView(randomBytes.buffer)
  const high = dataView.getUint32(0)
  const low = dataView.getUint32(4)
  const queryIdBig = ((BigInt(high) & BigInt(0x7fffffff)) << BigInt(32)) | BigInt(low)
  return queryIdBig.toString()
}

function isValidTonAddress(address: string): boolean {
  try {
    Address.parse(address)
    return true
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    let body: RequestBody
    try {
      body = (await request.json()) as RequestBody
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress.trim() : ''
    if (!walletAddress) {
      return new Response(JSON.stringify({ error: 'walletAddress is required.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!isValidTonAddress(walletAddress)) {
      return new Response(JSON.stringify({ error: 'Invalid TON wallet address.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    let context
    try {
      context = getRequestContext()
    } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB
    
    // Rate limit check
    if (await isRateLimited(request, db, { route: '/api/claims/intent', limit: 10, walletAddress })) {
      return new Response(JSON.stringify({ error: 'Too many requests.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const isProd = process.env.NODE_ENV === 'production'

    if (!db && isProd) {
      return new Response(JSON.stringify({ error: 'D1 DB binding is not configured. Server refuses demo claim intents in production.' }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      })
    }

    let userId = 'mock-user-id'
    let isDemo = true
    let currentRound = 0
    let packageCount = 0
    let highestClaimedRound = 0

    if (db) {
      isDemo = false
      const user = await getSessionUser(request, db)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
          status: 401, headers: { 'Content-Type': 'application/json' },
        })
      }
      userId = user.id

      // 1. Fetch chain data to verify availability
      const vesting = await getVestingData(env)
      if (vesting) {
        currentRound = vesting.currentUnlockedRound
      } else {
        const roundRow = await db.prepare("SELECT value FROM app_config WHERE key = 'diao_current_round'").first()
        currentRound = roundRow?.value ? Number(roundRow.value) : 0
      }

      const userPkgs = await getUserPackages(env, walletAddress)
      packageCount = userPkgs.packageCount
      highestClaimedRound = userPkgs.highestClaimedRound

      // 2. Reject if no packageCount
      if (packageCount <= 0) {
        return new Response(JSON.stringify({
          error: '链上查无此钱包的购买额度，无法发起领取。',
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }

      // 3. Reject if nothing is claimable
      if (highestClaimedRound >= currentRound) {
        return new Response(JSON.stringify({
          error: `无可领取份额。已领第 ${highestClaimedRound} 轮，当前解锁第 ${currentRound} 轮。`,
        }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
    } else {
      // Mock defaults
      currentRound = 1
      packageCount = 1
      highestClaimedRound = 0
    }

    const queryId = generateSecureQueryId()
    const claimId = `claim-${crypto.randomUUID()}`
    const nowIso = new Date().toISOString()
    const claimableDiao = (currentRound - highestClaimedRound) * packageCount * DIAO_TOKENOMICS.releasePerRound

    // Construct txParams for ClaimBuyer
    const valueNano = '100000000' // 0.1 TON gas
    const payloadCell = buildClaimBuyerPayload(BigInt(queryId))
    const payloadBase64 = payloadCell.toBoc().toString('base64')

    const txParams = {
      to: DIAO_CONTRACTS.vestingController,
      value: valueNano,
      payload: payloadBase64,
    }

    if (db) {
      await db.prepare(
        `INSERT INTO diao_claims (id, user_id, wallet_address, query_id, requested_round, confirmed_highest_claimed_round, claimable_diao, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_wallet_signature', ?, ?)`
      ).bind(claimId, userId, walletAddress, queryId, currentRound, highestClaimedRound, claimableDiao, nowIso, nowIso).run()
    }

    return new Response(JSON.stringify({
      claim: {
        claimId,
        queryId,
        walletAddress,
        requestedRound: currentRound,
        highestClaimedRound,
        claimableDiao,
        status: 'pending_wallet_signature',
        source: isDemo ? 'demo' : 'api',
      },
      txParams,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}
