import { beginCell, Cell } from '@ton/core'

export const OP_BUY_PACKAGE = 0x42555950
export const OP_CLAIM_BUYER = 0x434c6275

export function buildBuyPackagePayload(packageCount: number, queryId: bigint): Cell {
  return beginCell()
    .storeUint(OP_BUY_PACKAGE, 32)
    .storeUint(queryId, 64)
    .storeUint(packageCount, 8)
    .endCell()
}

export function buildClaimBuyerPayload(queryId: bigint): Cell {
  return beginCell()
    .storeUint(OP_CLAIM_BUYER, 32)
    .storeUint(queryId, 64)
    .endCell()
}

export function parsePayload(cell: Cell): { opcode: number; queryId: string; packageCount?: number } {
  const slice = cell.beginParse()
  if (slice.remainingBits < 32) {
    throw new Error('Payload too short (missing opcode)')
  }
  const opcode = slice.loadUint(32)

  if (slice.remainingBits < 64) {
    throw new Error('Payload too short (missing queryId)')
  }
  const queryId = slice.loadUintBig(64).toString()

  if (opcode === OP_BUY_PACKAGE) {
    if (slice.remainingBits < 8) {
      throw new Error('Payload too short (missing packageCount)')
    }
    const packageCount = slice.loadUint(8)
    return { opcode, queryId, packageCount }
  }

  return { opcode, queryId }
}
