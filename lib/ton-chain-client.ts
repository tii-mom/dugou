import { TonClient } from '@ton/ton'
import { Address, beginCell } from '@ton/core'
import { DIAO_CONTRACTS, DIAO_TOKENOMICS } from './ton-config'
import { parsePayload, OP_BUY_PACKAGE, OP_CLAIM_BUYER } from './ton-payload'

interface MockDB {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      first: () => Promise<Record<string, unknown> | null>
    }
    first: () => Promise<Record<string, unknown> | null>
  }
}

export interface ChainClientEnv {
  DB?: unknown
  CHAIN_INDEXER_MODE?: unknown
  TON_API_BASE_URL?: unknown
  TON_API_KEY?: unknown
}

function getClient(env: ChainClientEnv): TonClient {
  const endpoint = String(env.TON_API_BASE_URL || process.env.TON_API_BASE_URL || 'https://toncenter.com/api/v2/jsonRPC')
  const apiKey = env.TON_API_KEY ? String(env.TON_API_KEY) : (process.env.TON_API_KEY ? String(process.env.TON_API_KEY) : undefined)
  return new TonClient({ endpoint, apiKey })
}

export async function getVestingData(env: ChainClientEnv) {
  const isMock = (env.CHAIN_INDEXER_MODE || process.env.CHAIN_INDEXER_MODE) === 'mock'
  if (isMock) {
    const db = env.DB as MockDB | undefined
    let round = 0
    let totalSold = 0
    if (db) {
      const roundRow = await db.prepare("SELECT value FROM app_config WHERE key = 'diao_current_round'").first()
      if (roundRow?.value) round = Number(roundRow.value)
      const soldRow = await db.prepare("SELECT COALESCE(SUM(package_count),0) as total FROM diao_purchases WHERE status = 'confirmed'").first()
      if (soldRow?.total) totalSold = Number(soldRow.total)
    }

    return {
      adminAddress: DIAO_CONTRACTS.admin,
      priceSourceAddress: DIAO_CONTRACTS.admin,
      treasuryAddress: DIAO_CONTRACTS.treasury,
      officialReserveAddress: DIAO_CONTRACTS.officialReserve,
      teamAddress: DIAO_CONTRACTS.teamWallet,
      emergencyRescueAddress: DIAO_CONTRACTS.emergencyRescue,
      jettonMinterAddress: DIAO_CONTRACTS.jettonMinter,
      saleActive: true,
      saleFinalized: false,
      paused: false,
      totalPackagesSold: totalSold,
      currentUnlockedRound: round,
      pendingRound: 0,
      pendingSubmittedAt: 0,
      reserveAlreadyClaimed: '0',
      teamClaimedRound: 0,
      funded: true,
      emergencyRescued: '0',
    }
  }

  try {
    const client = getClient(env)
    const address = Address.parse(DIAO_CONTRACTS.vestingController)
    const result = await client.runMethod(address, 'get_vesting_data', [])
    const reader = result.stack

    return {
      adminAddress: reader.readAddress().toString(),
      priceSourceAddress: reader.readAddress().toString(),
      treasuryAddress: reader.readAddress().toString(),
      officialReserveAddress: reader.readAddress().toString(),
      teamAddress: reader.readAddress().toString(),
      emergencyRescueAddress: reader.readAddress().toString(),
      jettonMinterAddress: reader.readAddress().toString(),
      saleActive: reader.readBoolean(),
      saleFinalized: reader.readBoolean(),
      paused: reader.readBoolean(),
      totalPackagesSold: Number(reader.readBigNumber()),
      currentUnlockedRound: Number(reader.readBigNumber()),
      pendingRound: Number(reader.readBigNumber()),
      pendingSubmittedAt: Number(reader.readBigNumber()),
      reserveAlreadyClaimed: reader.readBigNumber().toString(),
      teamClaimedRound: Number(reader.readBigNumber()),
      funded: reader.readBoolean(),
      emergencyRescued: reader.readBigNumber().toString(),
    }
  } catch (error) {
    console.error('Error fetching vesting data from chain:', error)
    return null
  }
}

export async function getUserPackages(env: ChainClientEnv, walletAddress: string) {
  if (!walletAddress) return { packageCount: 0, highestClaimedRound: 0 }

  const isMock = (env.CHAIN_INDEXER_MODE || process.env.CHAIN_INDEXER_MODE) === 'mock'
  if (isMock) {
    const db = env.DB as MockDB | undefined
    let packageCount = 0
    let highestClaimedRound = 0
    if (db) {
      const purchaseRow = await db.prepare(
        "SELECT COALESCE(SUM(package_count),0) as total FROM diao_purchases WHERE wallet_address = ? AND status = 'confirmed'"
      ).bind(walletAddress).first()
      if (purchaseRow?.total) packageCount = Number(purchaseRow.total)

      const claimRow = await db.prepare(
        "SELECT COALESCE(MAX(confirmed_highest_claimed_round),0) as max_round FROM diao_claims WHERE wallet_address = ? AND status = 'confirmed'"
      ).bind(walletAddress).first()
      if (claimRow?.max_round) highestClaimedRound = Number(claimRow.max_round)
    }
    return { packageCount, highestClaimedRound }
  }

  try {
    const client = getClient(env)
    const controllerAddress = Address.parse(DIAO_CONTRACTS.vestingController)
    const userAddr = Address.parse(walletAddress)
    const cell = beginCell().storeAddress(userAddr).endCell()
    const result = await client.runMethod(controllerAddress, 'get_user_packages', [
      { type: 'slice', cell }
    ])
    const reader = result.stack
    const packageCount = Number(reader.readBigNumber())
    const highestClaimedRound = Number(reader.readBigNumber())
    return { packageCount, highestClaimedRound }
  } catch (error) {
    console.error('Error fetching user packages from chain:', error)
    return { packageCount: 0, highestClaimedRound: 0 }
  }
}

export async function getDiaoBalance(env: ChainClientEnv, walletAddress: string): Promise<bigint> {
  if (!walletAddress) return BigInt(0)

  const isMock = (env.CHAIN_INDEXER_MODE || process.env.CHAIN_INDEXER_MODE) === 'mock'
  if (isMock) {
    const db = env.DB as MockDB | undefined
    let packageCount = 0
    let highestClaimedRound = 0
    if (db) {
      const purchaseRow = await db.prepare(
        "SELECT COALESCE(SUM(package_count),0) as total FROM diao_purchases WHERE wallet_address = ? AND status = 'confirmed'"
      ).bind(walletAddress).first()
      if (purchaseRow?.total) packageCount = Number(purchaseRow.total)

      const claimRow = await db.prepare(
        "SELECT COALESCE(MAX(confirmed_highest_claimed_round),0) as max_round FROM diao_claims WHERE wallet_address = ? AND status = 'confirmed'"
      ).bind(walletAddress).first()
      if (claimRow?.max_round) highestClaimedRound = Number(claimRow.max_round)
    }
    const immediate = packageCount * DIAO_TOKENOMICS.immediatePerPackage
    const released = highestClaimedRound * packageCount * DIAO_TOKENOMICS.releasePerRound
    return BigInt((immediate + released) * 1e9) // in nanotoken
  }

  try {
    const client = getClient(env)
    const minterAddress = Address.parse(DIAO_CONTRACTS.jettonMinter)
    const userAddr = Address.parse(walletAddress)
    const cell = beginCell().storeAddress(userAddr).endCell()

    // 1. Get user's Jetton Wallet address
    const resultWallet = await client.runMethod(minterAddress, 'get_wallet_address', [
      { type: 'slice', cell }
    ])
    const walletAddressCell = resultWallet.stack.readAddress()

    // 2. Get Jetton Wallet data (balance)
    const resultData = await client.runMethod(walletAddressCell, 'get_wallet_data', [])
    const balance = resultData.stack.readBigNumber()
    return balance
  } catch (error) {
    console.error('Error fetching DIAO balance from chain:', error)
    return BigInt(0)
  }
}

export async function findBuyPackageTransaction(
  env: ChainClientEnv,
  walletAddress: string,
  queryId: string,
  packageCount: number,
  expectedNanoTon: bigint,
  expiresAt: string
) {
  const isMock = (env.CHAIN_INDEXER_MODE || process.env.CHAIN_INDEXER_MODE) === 'mock'
  if (isMock) {
    const db = env.DB as MockDB | undefined
    if (!db) return null
    const row = await db.prepare(
      "SELECT * FROM mock_chain_txs WHERE sender = ? AND query_id = ? AND opcode = ? AND success = 1"
    ).bind(walletAddress, queryId, OP_BUY_PACKAGE).first()
    if (!row) return null

    // Check transaction validity
    const receiverOk = String(row.receiver || '').toLowerCase() === DIAO_CONTRACTS.vestingController.toLowerCase()
    const amountOk = BigInt(String(row.amount_nano || '0')) >= expectedNanoTon
    const countOk = Number(row.package_count || 0) === packageCount
    if (!receiverOk || !amountOk || !countOk) {
      console.log('Mock transaction validation failed:', { receiverOk, amountOk, countOk })
      return null
    }

    return {
      hash: String(row.hash),
      lt: String(row.lt),
      utime: Math.floor(Date.now() / 1000),
    }
  }

  // Real blockchain indexer loop with pagination
  try {
    const client = getClient(env)
    const controllerAddress = Address.parse(DIAO_CONTRACTS.vestingController)
    const userAddress = Address.parse(walletAddress)

    let lt: string | undefined = undefined
    let hash: string | undefined = undefined
    let hasMore = true
    const expiresUtime = Math.floor(new Date(expiresAt).getTime() / 1000)

    while (hasMore) {
      const txs = await client.getTransactions(controllerAddress, {
        limit: 20,
        lt,
        hash,
      })

      if (txs.length === 0) {
        hasMore = false
        break
      }

      for (const tx of txs) {
        // Expiry check
        if (tx.now < expiresUtime) {
          hasMore = false
          break
        }

        // Verify generic successful transaction
        const desc = tx.description
        if (desc.type === 'generic') {
          const compute = desc.computePhase
          if (compute && compute.type === 'vm' && compute.exitCode !== 0) continue
          if (desc.aborted) continue
          if (desc.actionPhase && !desc.actionPhase.success) continue
        } else {
          continue
        }

        const inMsg = tx.inMessage
        if (!inMsg || inMsg.info.type !== 'internal') continue

        const src = inMsg.info.src
        if (!src || !src.equals(userAddress)) continue

        // Value check
        const value = inMsg.info.value.coins
        if (value < expectedNanoTon) continue

        // Parse body payload
        const body = inMsg.body
        if (!body) continue

        try {
          const { opcode, queryId: parsedQueryId, packageCount: parsedCount } = parsePayload(body)
          if (opcode !== OP_BUY_PACKAGE) continue
          if (parsedQueryId !== queryId) continue
          if (parsedCount !== packageCount) continue

          // Found!
          return {
            hash: tx.hash().toString('base64'),
            lt: tx.lt.toString(),
            utime: tx.now,
          }
        } catch {
          continue
        }
      }

      if (hasMore) {
        const lastTx = txs[txs.length - 1]
        lt = lastTx.lt.toString()
        hash = lastTx.hash().toString('base64')
      }
    }
  } catch (error) {
    console.error('Error querying blockchain transactions:', error)
  }

  return null
}

export async function findClaimBuyerTransaction(
  env: ChainClientEnv,
  walletAddress: string,
  queryId: string,
  expiresAt: string
) {
  const isMock = (env.CHAIN_INDEXER_MODE || process.env.CHAIN_INDEXER_MODE) === 'mock'
  if (isMock) {
    const db = env.DB as MockDB | undefined
    if (!db) return null
    const row = await db.prepare(
      "SELECT * FROM mock_chain_txs WHERE sender = ? AND query_id = ? AND opcode = ? AND success = 1"
    ).bind(walletAddress, queryId, OP_CLAIM_BUYER).first()
    if (!row) return null

    // Check transaction validity
    const receiverOk = String(row.receiver || '').toLowerCase() === DIAO_CONTRACTS.vestingController.toLowerCase()
    const amountOk = BigInt(String(row.amount_nano || '0')) >= BigInt(100_000_000)
    if (!receiverOk || !amountOk) {
      console.log('Mock claim transaction validation failed:', { receiverOk, amountOk })
      return null
    }

    return {
      hash: String(row.hash),
      lt: String(row.lt),
      utime: Math.floor(Date.now() / 1000),
    }
  }

  // Real blockchain indexer loop with pagination
  try {
    const client = getClient(env)
    const controllerAddress = Address.parse(DIAO_CONTRACTS.vestingController)
    const userAddress = Address.parse(walletAddress)

    let lt: string | undefined = undefined
    let hash: string | undefined = undefined
    let hasMore = true
    const expiresUtime = Math.floor(new Date(expiresAt).getTime() / 1000)

    while (hasMore) {
      const txs = await client.getTransactions(controllerAddress, {
        limit: 20,
        lt,
        hash,
      })

      if (txs.length === 0) {
        hasMore = false
        break
      }

      for (const tx of txs) {
        // Expiry check
        if (tx.now < expiresUtime) {
          hasMore = false
          break
        }

        // Verify generic successful transaction
        const desc = tx.description
        if (desc.type === 'generic') {
          const compute = desc.computePhase
          if (compute && compute.type === 'vm' && compute.exitCode !== 0) continue
          if (desc.aborted) continue
          if (desc.actionPhase && !desc.actionPhase.success) continue
        } else {
          continue
        }

        const inMsg = tx.inMessage
        if (!inMsg || inMsg.info.type !== 'internal') continue

        const src = inMsg.info.src
        if (!src || !src.equals(userAddress)) continue

        // Value check
        const value = inMsg.info.value.coins
        if (value < BigInt(100_000_000)) continue

        // Parse body payload
        const body = inMsg.body
        if (!body) continue

        try {
          const { opcode, queryId: parsedQueryId } = parsePayload(body)
          if (opcode !== OP_CLAIM_BUYER) continue
          if (parsedQueryId !== queryId) continue

          // Found!
          return {
            hash: tx.hash().toString('base64'),
            lt: tx.lt.toString(),
            utime: tx.now,
          }
        } catch {
          continue
        }
      }

      if (hasMore) {
        const lastTx = txs[txs.length - 1]
        lt = lastTx.lt.toString()
        hash = lastTx.hash().toString('base64')
      }
    }
  } catch (error) {
    console.error('Error querying blockchain transactions:', error)
  }

  return null
}
