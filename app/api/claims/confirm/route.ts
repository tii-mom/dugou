import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'
import { findClaimBuyerTransaction, getUserPackages } from '@/lib/ton-chain-client'

export const runtime = 'edge'

async function confirmClaim(request: Request, claimId: string) {
  let context
  try {
    context = getRequestContext()
  } catch {}
  const env = (context?.env || {}) as CloudflareEnv
  const db = env.DB

  if (!db) {
    // Demo mode: mock confirm
    return new Response(JSON.stringify({
      status: 'confirmed',
      claim: {
        id: claimId,
        requestedRound: 1,
        confirmedHighestClaimedRound: 1,
        claimableDiao: 200000,
        status: 'confirmed',
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const user = await getSessionUser(request, db)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const claim = await db.prepare(
    "SELECT * FROM diao_claims WHERE id = ? AND user_id = ?"
  ).bind(claimId, user.id).first()

  if (!claim) {
    return new Response(JSON.stringify({ error: 'Claim not found.' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (claim.status === 'confirmed') {
    return new Response(JSON.stringify({
      status: 'confirmed',
      claim,
      message: '领取交易已确认。'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  if (claim.status === 'expired' || claim.status === 'failed') {
    return new Response(JSON.stringify({
      status: claim.status,
      message: claim.error_message || '该领取交易已失效或核验失败。'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const now = new Date()
  const expiresAt = new Date(Date.parse(String(claim.created_at)) + 15 * 60 * 1000)
  const isExpired = now > expiresAt

  const tx = await findClaimBuyerTransaction(
    env,
    String(claim.wallet_address),
    String(claim.query_id),
    String(claim.created_at)
  )

  const nowIso = now.toISOString()

  if (tx) {
    const requestedRound = Number(claim.requested_round)

    // 1. Update claim record status to confirmed first
    await db.prepare(
      `UPDATE diao_claims
       SET status = 'confirmed', confirmed_highest_claimed_round = ?, chain_tx_hash = ?, chain_lt = ?, confirmed_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(requestedRound, tx.hash, tx.lt, nowIso, nowIso, claimId).run()

    // 2. Get user packages state on-chain
    const chainPackages = await getUserPackages(env, String(claim.wallet_address))
    const highestClaimedRound = chainPackages.highestClaimedRound

    // 3. Sync local purchases ledger highestClaimedRound
    await db.prepare(
      "UPDATE diao_purchases SET highest_claimed_round = ?, updated_at = ? WHERE user_id = ? AND wallet_address = ?"
    ).bind(highestClaimedRound, nowIso, user.id, String(claim.wallet_address)).run()

    const updatedClaim = {
      ...claim,
      status: 'confirmed',
      confirmed_highest_claimed_round: highestClaimedRound,
      chain_tx_hash: tx.hash,
      chain_lt: tx.lt,
      confirmed_at: nowIso,
    }

    return new Response(JSON.stringify({
      status: 'confirmed',
      claim: updatedClaim,
      message: '链上领取确认成功！本地账本已同步最新解锁进度。'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  if (isExpired) {
    await db.prepare(
      "UPDATE diao_claims SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?"
    ).bind('未在规定时间内扫描到链上领取交易，已超时失效。', nowIso, claimId).run()

    return new Response(JSON.stringify({
      status: 'failed',
      message: '核验超时：未检测到有效交易。'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({
    status: 'pending_chain_confirmation',
    message: '正在扫描链上领取交易，请稍候...'
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export async function POST(request: Request) {
  try {
    let body: { claimId?: unknown }
    try {
      body = (await request.json()) as { claimId?: unknown }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }
    const claimId = typeof body.claimId === 'string' ? body.claimId.trim() : ''
    if (!claimId) {
      return new Response(JSON.stringify({ error: 'claimId is required.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }
    return confirmClaim(request, claimId)
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const claimId = searchParams.get('claimId') || ''
    if (!claimId) {
      return new Response(JSON.stringify({ error: 'claimId is required.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }
    return confirmClaim(request, claimId)
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}
