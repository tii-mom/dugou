import { type TokenSalePackage, type TokenSaleRound } from '@/lib/business-types'

export const DIAO_TOTAL_SUPPLY = 10_000_000_000
export const DIAO_INITIAL_UNLOCKED_SUPPLY = 1_000_000_000
export const DIAO_LOCKED_SUPPLY = 9_000_000_000
export const DIAO_INITIAL_PRICE_USD = 0.00001

export const DIAO_SALE_PACKAGE: TokenSalePackage = {
  tonPrice: 58,
  contractGasBufferTon: 0.1,
  immediateDIAO: 200_000,
  lockedDIAO: 3_000_000,
  releaseRounds: 15,
  perRoundDIAO: 200_000,
  maxPackagesPerWallet: 10,
  maxPackagesTotal: 2_000,
}

export const DIAO_UNLOCK_ROUNDS: TokenSaleRound[] = Array.from({ length: 18 }, (_, index) => {
  const round = index + 1
  const multipleFromInitial = 2 ** round
  return {
    round,
    unlockPriceUsd: Number((DIAO_INITIAL_PRICE_USD * multipleFromInitial).toFixed(5)),
    multipleFromInitial,
    amountDIAO: 500_000_000,
    destination: round <= 15 ? 'participants' : 'team',
  }
})

export function formatDIAO(amount: number) {
  return `${amount.toLocaleString()} DIAO`
}

export function calculateTokenSaleIntent(packages: number) {
  const totalTon = packages * DIAO_SALE_PACKAGE.tonPrice
  return {
    packages,
    totalTon,
    contractGasBufferTon: DIAO_SALE_PACKAGE.contractGasBufferTon,
    contractRequiredTon: Number((totalTon + DIAO_SALE_PACKAGE.contractGasBufferTon).toFixed(1)),
    immediateDIAO: packages * DIAO_SALE_PACKAGE.immediateDIAO,
    lockedDIAO: packages * DIAO_SALE_PACKAGE.lockedDIAO,
    perRoundDIAO: packages * DIAO_SALE_PACKAGE.perRoundDIAO,
  }
}
