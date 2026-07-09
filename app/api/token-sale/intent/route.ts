import { getRequestContext } from '@cloudflare/next-on-pages'
import { Address } from '@ton/core'
import { getSessionUser } from '@/lib/auth-server'
import { isRateLimited } from '@/lib/rate-limit'
import { calculateTokenSaleIntent, DIAO_SALE_PACKAGE } from '@/lib/token-sale'
import { DIAO_CONTRACTS } from '@/lib/ton-config'
import { buildBuyPackagePayload } from '@/lib/ton-payload'
import { getUserPackages } from '@/lib/ton-chain-client'

export const runtime = 'edge'

type RequestBody = {
  walletAddress?: unknown
  packages?: unknown
}

function generateSecureQueryId(): string {
  const randomBytes = new Uint8Array(8)
  crypto.getRandomValues(randomBytes)
  const dataView = new DataView(randomBytes.buffer)
  const high = dataView.getUint32(0)
  const low = dataView.getUint32(4)
  // Ensure a positive 63-bit BigInt to be safe on-chain
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
    const packages = Number(body.packages)

    if (!walletAddress) {
      return new Response(JSON.stringify({ error: 'Wallet address is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!isValidTonAddress(walletAddress)) {
      return new Response(JSON.stringify({ error: 'Invalid TON wallet address.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!Number.isInteger(packages) || packages < 1 || packages > DIAO_SALE_PACKAGE.maxPackagesPerWallet) {
      return new Response(
        JSON.stringify({
          error: `Packages must be an integer from 1 to ${DIAO_SALE_PACKAGE.maxPackagesPerWallet}.`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    let context
    try {
      context = getRequestContext()
    } catch {}
    const env = (context?.env || {}) as CloudflareEnv
    const db = env.DB
    
    // Rate limit check
    if (await isRateLimited(request, db, { route: '/api/token-sale/intent', limit: 10, walletAddress: typeof walletAddress === 'string' ? walletAddress : undefined })) {
      return new Response(JSON.stringify({ error: 'Too many requests.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const isProd = process.env.NODE_ENV === 'production'

    if (!db && isProd) {
      return new Response(JSON.stringify({ error: 'D1 DB binding is not configured. Server refuses demo purchase intents in production.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let userId = 'mock-user-id'
    let isDemo = true

    if (db) {
      isDemo = false
      const user = await getSessionUser(request, db)
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      userId = user.id

      // Mark expired pending intents as expired
      const nowIsoStr = new Date().toISOString()
      await db.prepare(`
        UPDATE diao_sale_intents
        SET status = 'expired',
            error_message = 'Intent expired before payment confirmation.',
            updated_at = ?
        WHERE (user_id = ? OR wallet_address = ?)
          AND expires_at IS NOT NULL
          AND expires_at < ?
          AND status IN ('pending_wallet_signature', 'broadcasted', 'pending_chain_confirmation')
      `).bind(nowIsoStr, userId, walletAddress, nowIsoStr).run()

      // 累计校验：按 wallet_address + user_id 统计非 rejected/cancelled/failed/expired intents 里的 packages 总数
      const row = await db
        .prepare(
          "SELECT SUM(packages) as total FROM diao_sale_intents WHERE (user_id = ? OR wallet_address = ?) AND status NOT IN ('rejected', 'cancelled', 'failed', 'expired')"
        )
        .bind(userId, walletAddress)
        .first()

      const existingPackages = row?.total ? Number(row.total) : 0
      const chainPackages = await getUserPackages(env, walletAddress)
      const activePackages = Math.max(existingPackages, chainPackages.packageCount)
      if (activePackages + packages > DIAO_SALE_PACKAGE.maxPackagesPerWallet) {
        return new Response(
          JSON.stringify({
            error: `累积购买额度已达上限。您当前已购买或待处理 ${activePackages} 份，本次最多还能购买 ${DIAO_SALE_PACKAGE.maxPackagesPerWallet - activePackages} 份。`,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }
    }

    const totals = calculateTokenSaleIntent(packages)
    const intentId = `diao-sale-${crypto.randomUUID()}`
    const queryId = generateSecureQueryId()
    const nowIso = new Date().toISOString()
    const expiresIso = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 mins expiry
    const finalStatus = 'pending_wallet_signature'

    const expectedAmountNano = String(BigInt(Math.ceil(totals.totalTon * 1e9)))
    // Build transaction parameters for TonConnect (include gas buffer)
    const valueNano = String(BigInt(Math.ceil((totals.totalTon + totals.contractGasBufferTon) * 1e9)))
    const payloadCell = buildBuyPackagePayload(packages, BigInt(queryId))
    const payloadBase64 = payloadCell.toBoc().toString('base64')

    const txParams = {
      to: DIAO_CONTRACTS.vestingController,
      value: valueNano,
      payload: payloadBase64,
    }

    const message = '已创建购买意向，等待钱包签名。'

    if (db) {
      try {
        await db
          .prepare(
            `INSERT INTO diao_sale_intents (id, user_id, wallet_address, packages, total_ton, immediate_diao, locked_diao, per_round_diao, status, created_at, updated_at, query_id, expected_amount_nano, expires_at, total_ton_nano)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            intentId,
            userId,
            walletAddress,
            packages,
            totals.totalTon,
            totals.immediateDIAO,
            totals.lockedDIAO,
            totals.perRoundDIAO,
            finalStatus,
            nowIso,
            nowIso,
            queryId,
            expectedAmountNano,
            expiresIso,
            expectedAmountNano
          )
          .run()
      } catch (insertError) {
        const message = insertError instanceof Error ? insertError.message : String(insertError)
        if (message.toLowerCase().includes('column')) {
          await db
            .prepare(
              `INSERT INTO diao_sale_intents (id, user_id, wallet_address, packages, total_ton, immediate_diao, locked_diao, per_round_diao, status, created_at, updated_at, query_id, expected_amount_nano, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              intentId,
              userId,
              walletAddress,
              packages,
              totals.totalTon,
              totals.immediateDIAO,
              totals.lockedDIAO,
              totals.perRoundDIAO,
              finalStatus,
              nowIso,
              nowIso,
              queryId,
              expectedAmountNano,
              expiresIso
            )
            .run()
        } else if (message.toLowerCase().includes('unique')) {
          return new Response(JSON.stringify({
            error: '已有进行中的购买意向，请先完成、取消或等待过期后再创建新的购买意向。',
          }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          })
        } else {
          throw insertError
        }
      }
    }

    return new Response(
      JSON.stringify({
        intent: {
          intentId,
          queryId,
          walletAddress,
          packages,
          totalTon: totals.totalTon,
          contractGasBufferTon: totals.contractGasBufferTon,
          contractRequiredTon: totals.contractRequiredTon,
          immediateDIAO: totals.immediateDIAO,
          lockedDIAO: totals.lockedDIAO,
          perRoundDIAO: totals.perRoundDIAO,
          status: finalStatus,
          message,
          expiresAt: expiresIso,
          source: isDemo ? 'demo' : 'api',
        },
        txParams,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
