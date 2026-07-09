import { getRequestContext } from '@cloudflare/next-on-pages'
import { getSessionUser } from '@/lib/auth-server'
import { findBuyPackageTransaction, getUserPackages } from '@/lib/ton-chain-client'
import { isRateLimited } from '@/lib/rate-limit'
import { DIAO_TOKENOMICS } from '@/lib/ton-config'

export const runtime = 'edge'

async function confirmIntent(request: Request, intentId: string) {
  let context
  try {
    context = getRequestContext()
  } catch {}
  const env = (context?.env || {}) as CloudflareEnv
  const db = env.DB
  
  // Rate limit check
  if (await isRateLimited(request, db, { route: '/api/purchases/confirm', limit: 20 })) {
    return new Response(JSON.stringify({ error: 'Too many requests.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const isProd = process.env.NODE_ENV === 'production'

  if (!db) {
    if (isProd) {
      return new Response(JSON.stringify({ error: 'D1 DB binding is not configured. Server refuses mock purchase confirmation in production.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // Demo mode: local-only mock confirm
    return new Response(JSON.stringify({
      status: 'confirmed',
      purchase: {
        id: `mock-p-${crypto.randomUUID()}`,
        packageCount: 1,
        paidTon: 58.0,
        immediateDiao: 200000,
        lockedDiao: 3000000,
        totalDiao: 3200000,
        highestClaimedRound: 0,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const user = await getSessionUser(request, db)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const intent = await db.prepare(
    "SELECT * FROM diao_sale_intents WHERE id = ? AND user_id = ?"
  ).bind(intentId, user.id).first()

  if (!intent) {
    return new Response(JSON.stringify({ error: 'Intent not found.' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (intent.status === 'confirmed') {
    // Already confirmed, fetch and return purchase record
    const purchase = await db.prepare(
      "SELECT * FROM diao_purchases WHERE user_id = ? AND wallet_address = ? AND tx_hash = ?"
    ).bind(user.id, intent.wallet_address, intent.chain_tx_hash).first()

    return new Response(JSON.stringify({
      status: 'confirmed',
      purchase,
      message: '意向交易已确认。'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  if (intent.status === 'expired' || intent.status === 'failed') {
    return new Response(JSON.stringify({
      status: intent.status,
      message: intent.error_message || '该意向交易已失效或核验失败。'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  // Check if intent is expired
  const now = new Date()
  const expiresAt = new Date(String(intent.expires_at))
  const isExpired = now > expiresAt

  // Search transaction on chain / mock
  const expectedNanoTon = BigInt(String(intent.expected_amount_nano || (Number(intent.packages) * 58 * 1e9)))
  const walletAddress = String(intent.wallet_address)
  const queryId = String(intent.query_id)
  const packages = Number(intent.packages)

  const tx = await findBuyPackageTransaction(
    env,
    walletAddress,
    queryId,
    packages,
    expectedNanoTon,
    String(intent.created_at) // use intent creation time as lookback boundary
  )

  const nowIso = now.toISOString()

  if (tx) {
    // Transaction found and verified! Prevent duplicate hash in purchases
    const dup = await db.prepare(
      "SELECT id FROM diao_purchases WHERE tx_hash = ?"
    ).bind(tx.hash).first()

    if (dup) {
      await db.prepare(
        "UPDATE diao_sale_intents SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?"
      ).bind('交易 Hash 已被其他购买单录入。', nowIso, intentId).run()

      return new Response(JSON.stringify({
        status: 'failed',
        error: '交易哈希已被录入过。',
        message: '核验失败：交易已被使用。'
      }), { status: 409, headers: { 'Content-Type': 'application/json' } })
    }

    const chainMode = (env as unknown as { CHAIN_INDEXER_MODE?: string }).CHAIN_INDEXER_MODE || process.env.CHAIN_INDEXER_MODE || ''
    if (chainMode !== 'mock') {
      const chainPackages = await getUserPackages(env, walletAddress)
      if (chainPackages.packageCount < packages) {
        await db.prepare(
          "UPDATE diao_sale_intents SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?"
        ).bind('链上交易已找到，但合约用户购买额度未同步增加。', nowIso, intentId).run()

        return new Response(JSON.stringify({
          status: 'failed',
          error: 'On-chain package state mismatch.',
          message: '核验失败：交易存在，但合约购买额度未达到预期。'
        }), { status: 409, headers: { 'Content-Type': 'application/json' } })
      }
    }

    const purchaseId = `purchase-${crypto.randomUUID()}`
    const paidTon = packages * DIAO_TOKENOMICS.packagePriceTon // Only record sale amount (no buffer!)
    const immediateDiao = packages * DIAO_TOKENOMICS.immediatePerPackage
    const lockedDiao = packages * DIAO_TOKENOMICS.lockedPerPackage
    const totalDiao = packages * DIAO_TOKENOMICS.totalPerPackage

    const paidTonNano = String(BigInt(packages) * BigInt(Math.round(DIAO_TOKENOMICS.packagePriceTon * 1e9)))

    // Write confirmed purchase ledger
    try {
      await db.prepare(
        `INSERT INTO diao_purchases (id, user_id, wallet_address, tx_hash, package_count, paid_ton, immediate_diao, locked_diao, total_diao, highest_claimed_round, status, created_at, updated_at, paid_ton_nano)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'confirmed', ?, ?, ?)`
      ).bind(purchaseId, user.id, walletAddress, tx.hash, packages, paidTon, immediateDiao, lockedDiao, totalDiao, nowIso, nowIso, paidTonNano).run()
    } catch (insertError) {
      const message = insertError instanceof Error ? insertError.message : String(insertError)
      if (message.toLowerCase().includes('column')) {
        await db.prepare(
          `INSERT INTO diao_purchases (id, user_id, wallet_address, tx_hash, package_count, paid_ton, immediate_diao, locked_diao, total_diao, highest_claimed_round, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'confirmed', ?, ?)`
        ).bind(purchaseId, user.id, walletAddress, tx.hash, packages, paidTon, immediateDiao, lockedDiao, totalDiao, nowIso, nowIso).run()
      } else if (message.toLowerCase().includes('unique')) {
        await db.prepare(
          "UPDATE diao_sale_intents SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?"
        ).bind('交易 Hash 已被其他购买单录入。', nowIso, intentId).run()

        return new Response(JSON.stringify({
          status: 'failed',
          error: '交易哈希已被录入过。',
          message: '核验失败：交易已被使用。'
        }), { status: 409, headers: { 'Content-Type': 'application/json' } })
      } else {
        throw insertError
      }
    }

    // Update intent
    await db.prepare(
      `UPDATE diao_sale_intents
       SET status = 'confirmed', chain_tx_hash = ?, chain_lt = ?, confirmed_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(tx.hash, tx.lt, nowIso, nowIso, intentId).run()

    const purchase = {
      id: purchaseId,
      user_id: user.id,
      wallet_address: walletAddress,
      tx_hash: tx.hash,
      package_count: packages,
      paid_ton: paidTon,
      immediate_diao: immediateDiao,
      locked_diao: lockedDiao,
      total_diao: totalDiao,
      highest_claimed_round: 0,
      status: 'confirmed',
      created_at: nowIso,
    }

    return new Response(JSON.stringify({
      status: 'confirmed',
      purchase,
      message: '链上确认成功！DIAO 资产已入账。'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  // Not found on chain yet
  if (isExpired) {
    await db.prepare(
      "UPDATE diao_sale_intents SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?"
    ).bind('未在规定时间内扫描到链上付款交易，已超时失效。', nowIso, intentId).run()

    return new Response(JSON.stringify({
      status: 'failed',
      message: '核验超时：未检测到有效交易。'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({
    status: 'pending_chain_confirmation',
    message: '正在扫描链上交易，请耐心等待...'
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export async function POST(request: Request) {
  try {
    let body: { intentId?: unknown }
    try {
      body = (await request.json()) as { intentId?: unknown }
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }
    const intentId = typeof body.intentId === 'string' ? body.intentId.trim() : ''
    if (!intentId) {
      return new Response(JSON.stringify({ error: 'intentId is required.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }
    return confirmIntent(request, intentId)
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const intentId = searchParams.get('intentId') || ''
    if (!intentId) {
      return new Response(JSON.stringify({ error: 'intentId is required.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }
    return confirmIntent(request, intentId)
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}
