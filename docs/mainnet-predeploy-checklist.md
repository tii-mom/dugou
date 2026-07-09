# DIAO Mainnet Predeploy Checklist

Status: deployed on mainnet 2026-07-09. See `docs/mainnet-deployment-record.md`.

## Owner Confirmations

- [x] Mainnet deployment is approved.
- [ ] Admin wallet is correct: `UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD`
- [ ] Price admin wallet is correct: `UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD`
- [ ] Treasury wallet is correct: `UQDDSkodFARAsYCVSzE9MgMrYk44PF95UyZcYwLDFnkXskXp`
- [ ] Initial circulation wallet is correct: `UQBv9pBWH7R_gv2mGYXKwGX59S6RH7wuramDTRyb8OUqoycQ`
- [ ] Official reserve wallet is correct: `UQDo48rWrpPU9ouJk5ZoKzTFPHUfqt1tZEKvtFE73xcyGZFA`
- [ ] Team wallet is correct: `UQAXy5kyjrLT2mgIOB_AbhalM4R-ZL_bM2QjyY6hTS1FfktJ`
- [ ] Emergency rescue wallet is correct: `UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R`
- [ ] Single-wallet admin and price-admin governance risk is accepted.
- [ ] `0.05 TON` controller reserve after TON withdrawals is accepted.

## Metadata

- [ ] Metadata URL is final:
  `https://ivory-keen-perch-796.mypinata.cloud/ipfs/bafkreigsnrrxhqvxhst2xay7pythep5auoprv3ekuzruyp77jwtqjgp4im`
- [ ] Image URL is final:
  `https://ivory-keen-perch-796.mypinata.cloud/ipfs/bafybeiarg22nye43yqcgazwmibtykyuwhtslfh3xo3v5ktcml7skm7y5ve`
- [ ] Token name is `DIAO`.
- [ ] Token symbol is `DIAO`.
- [ ] Decimals are `9`.
- [ ] Description is final:
  `DIAO（屌）是一场机会的测试，代币的解锁与价格上涨相关，持有者有机会改变他们的命运，重启人生。`

## Local Verification

- [x] `npm test -- --runInBand` passes.
- [x] `npx tsc --noEmit` passes.
- [x] `npx blueprint build --all` compiles all contracts.
- [x] Mainnet cooldown is `86400` seconds.
- [x] Manual price validity is `172800` seconds.
- [x] `MIN_CONTROLLER_TON_RESERVE` is `0.05 TON`.
- [x] Emergency rescue is paused-only and restricted to the dedicated emergency rescue wallet.
- [x] Sold buyer entitlement is excluded from emergency rescue.
- [x] Testnet deployment verified `0.15/0.35/0.8 TON` init funding.
- [x] Testnet smoke verified buy, pause, and `rescue-diao 1`.

## Artifact Hashes

- DIAOJettonMinter:
  - hex: `47b3c56ff00d0d2f000ca51a19b9743c68e3054ee2f8a691ce7a70955083c79c`
  - base64: `R7PFb/ANDS8ADKUaGbl0PGjjBU7i+KaRznpwlVCDx5w=`
- DIAOJettonWallet:
  - hex: `8a4ada81373f783ed0fcb4817b192fdd0dd9bdd6e9b2d2b0f4f482d043960ab7`
  - base64: `ikragTc/eD7Q/LSBexkv3Q3ZvdbpstKw9PSC0EOWCrc=`
- DIAOVestingController:
  - hex: `b9b8a01e99ac6a6bc072f18478b0a4c901be3f48369cab63b2f1d6105187c342`
  - base64: `ubigHpmsamvAcvGEeLCkyQG+P0g2nKtjsvHWEFGHw0I=`

## Latest Testnet Deployment

- Minter: `EQBAvIvwJBID4zY8U0cVaRagD6YVCtB7PfCm5_ukVM4xA-3f`
- Vesting Controller: `EQBjdOMljVChlt0CxwbXo0ygkT-B1xW5YijDX-DHGIBFH2m8`
- Verification:
  - `funded = true`
  - circulation wallet DIAO: `1,000,000,000`
  - vesting wallet DIAO: `9,000,000,000`
  - package purchase: `1`
  - immediate buyer DIAO: `200,000`
  - paused emergency rescue: `1 DIAO`

## Environment

- [x] Deployer wallet is connected to mainnet.
- [x] Deployer wallet has enough mainnet TON.
- [x] `.env` does not contain a mainnet-dangerous `DIAO_TESTNET_WALLET` usage.
- [x] `.env` does not contain a mainnet-dangerous `DIAO_TESTNET_DEPLOY_SALT` usage.
- [x] Deployment command is run with `--mainnet`.
- [x] Mainnet deployment addresses are written down immediately after deployment.

## Post-Deployment Must Pass

- [x] Minter deployed.
- [x] Vesting Controller deployed.
- [x] `init_mint` completed.
- [x] Minter `mintable = false`.
- [x] Total supply is exactly `10,000,000,000 DIAO`.
- [x] Initial circulation wallet holds `1,000,000,000 DIAO`.
- [x] Vesting Controller wallet holds `9,000,000,000 DIAO`.
- [x] Vesting Controller `funded = true`.
- [x] Sale is open.
- [x] Chain metadata URL is correct.
- [ ] Wallet/explorer metadata display refreshed and visible.
- [x] No mainnet funds are moved beyond the planned deployment and initialization.
