# DIAO Mainnet Freeze

Status: ready for final owner review, not deployed.

## Token

- Name: DIAO
- Symbol: DIAO
- Decimals: 9
- Total supply: 10,000,000,000 DIAO
- Metadata URL: `https://ivory-keen-perch-796.mypinata.cloud/ipfs/bafkreigsnrrxhqvxhst2xay7pythep5auoprv3ekuzruyp77jwtqjgp4im`
- Image URL: `https://ivory-keen-perch-796.mypinata.cloud/ipfs/bafybeiarg22nye43yqcgazwmibtykyuwhtslfh3xo3v5ktcml7skm7y5ve`
- Description: `DIAO（屌）是一场机会的测试，代币的解锁与价格上涨相关，持有者有机会改变他们的命运，重启人生。`

## Mainnet Wallets

- Initial circulation wallet: `UQBv9pBWH7R_gv2mGYXKwGX59S6RH7wuramDTRyb8OUqoycQ`
- Official reserve wallet: `UQDo48rWrpPU9ouJk5ZoKzTFPHUfqt1tZEKvtFE73xcyGZFA`
- Team wallet: `UQAXy5kyjrLT2mgIOB_AbhalM4R-ZL_bM2QjyY6hTS1FfktJ`
- Emergency rescue wallet: `UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R`
- Admin wallet: `UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD`
- Price admin wallet: `UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD`
- Treasury wallet: `UQDDSkodFARAsYCVSzE9MgMrYk44PF95UyZcYwLDFnkXskXp`

## Supply Allocation

- Initial circulation: 1,000,000,000 DIAO
- Vesting controller: 9,000,000,000 DIAO
- Buyer and official reserve pool: 7,500,000,000 DIAO, rounds 1-15
- Team pool: 1,500,000,000 DIAO, rounds 16-18
- Round allocation: 500,000,000 DIAO per round

## Sale

- Package price: 58 TON
- Immediate buyer release per package: 200,000 DIAO
- Locked buyer release per package: 3,000,000 DIAO
- Total buyer entitlement per package: 3,200,000 DIAO
- Buyer release per round: 200,000 DIAO, rounds 1-15
- Max packages per wallet: 10
- Max packages total: 2,000
- Sale starts open after deployment.
- Admin can close/open sale before finalization.
- `finalize_sale` is irreversible and enables official reserve claims.

## Unlock Rules

- Initial DIAO/USD price: 0.00001
- Round 1 unlock price: 0.00002
- Each later round doubles the previous unlock price.
- Manual price feed cooldown: 24 hours, `86400` seconds
- Manual price feed validity: 48 hours, `172800` seconds
- Unlocks are sequential.
- One transaction unlocks one round.
- Skipping rounds is rejected.
- Rounds 1-15 unlock buyer claims and official reserve remainder.
- Rounds 16-18 unlock team claims only.

## Deployment Safety

- Mainnet deployment must not set `DIAO_TESTNET_DEPLOY_SALT`.
- Mainnet deployment must not use `DIAO_TESTNET_WALLET` as a wallet override.
- The deployment script only applies testnet wallet override and testnet salt when `provider.network() === 'testnet'`.
- Minter performs one-time `init_mint`, then `mintable = false`.
- No arbitrary future minting is expected after deployment.

## Emergency Controls

- Admin can pause the vesting controller.
- While paused, normal purchases, price submission, unlocks, and claims are blocked.
- Admin can withdraw TON to the treasury while preserving `0.05 TON` in the controller.
- Admin can execute `EmergencyRescueDiao` only while the controller is paused.
- Emergency DIAO rescue recipient is restricted to the dedicated emergency rescue wallet: `UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R`.
- Emergency DIAO rescue is capped to unsold/unclaimed official reserve plus unclaimed team allocation, minus previous emergency rescues.
- Sold buyer entitlement is excluded from the rescueable amount and must remain in the vesting controller.

## Verification Completed

- Local tests pass with 24h cooldown configuration: 19 tests.
- Blueprint build succeeds for all contracts.
- Testnet full supply path was executed with a temporary 15-second cooldown build:
  - 1B initial circulation
  - 9B vesting funding
  - package purchase
  - rounds 1-18 sequential unlock
  - buyer rounds 1-15 claim
  - reserve claim after finalization
  - team rounds 16-18 claim
  - vesting balance reached 0
- Latest testnet deployment after adding the dedicated emergency rescue wallet verified:
  - init funding values: `0.15 TON` circulation leg, `0.35 TON` vesting leg, `0.8 TON` total
  - `funded = true`
  - circulation wallet balance: `1,000,000,000 DIAO`
  - vesting wallet balance: `9,000,000,000 DIAO`
  - one 58 TON package purchase
  - admin pause
  - `EmergencyRescueDiao` of `1 DIAO` to the configured rescue wallet

## Audit Status

An independent smart-contract audit is still recommended before mainnet deployment. The local tests and testnet execution validate intended behavior, but they do not replace a security audit.
