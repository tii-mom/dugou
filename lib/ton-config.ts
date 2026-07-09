export const DIAO_CONTRACTS = {
  jettonMinter: 'EQDO5Wl-jFR2A9UrgZZKqQbV_2Ab56HZqMbVbj3G2noXJq3Y',
  vestingController: 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot',
  initialCirculation: 'UQBv9pBWH7R_gv2mGYXKwGX59S6RH7wuramDTRyb8OUqoycQ',
  officialReserve: 'UQDo48rWrpPU9ouJk5ZoKzTFPHUfqt1tZEKvtFE73xcyGZFA',
  teamWallet: 'UQAXy5kyjrLT2mgIOB_AbhalM4R-ZL_bM2QjyY6hTS1FfktJ',
  emergencyRescue: 'UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R',
  admin: 'UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD',
  treasury: 'UQDDSkodFARAsYCVSzE9MgMrYk44PF95UyZcYwLDFnkXskXp',
} as const

export const DIAO_TOKENOMICS = {
  totalSupply: 10_000_000_000,
  decimals: 9,
  initialCirculation: 1_000_000_000,
  lockedSupply: 9_000_000_000,
  roundAllocation: 500_000_000,
  packagePriceTon: 58,
  immediatePerPackage: 200_000,
  lockedPerPackage: 3_000_000,
  totalPerPackage: 3_200_000,
  releasePerRound: 200_000,
  maxBuyerRounds: 15,
  totalRounds: 18,
  maxPackagesPerWallet: 10,
  maxPackagesTotal: 2000,
  initialPriceUsd: 0.00001,
  round18PriceUsd: 2.62144, // 第 18 轮目标价
  metadataUrl: 'https://ivory-keen-perch-796.mypinata.cloud/ipfs/bafkreigsnrrxhqvxhst2xay7pythep5auoprv3ekuzruyp77jwtqjgp4im',
} as const

// BuyPackage opcode = 0x42555950
export const OP_BUY_PACKAGE = 0x42555950
// ClaimBuyer opcode = 0x434c6275
export const OP_CLAIM_BUYER = 0x434c6275
