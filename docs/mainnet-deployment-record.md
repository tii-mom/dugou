# DIAO Mainnet Deployment Record

Date: 2026-07-09

## Deployed Contracts

- DIAO Jetton Minter: `EQDO5Wl-jFR2A9UrgZZKqQbV_2Ab56HZqMbVbj3G2noXJq3Y`
- DIAO Vesting Controller: `EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot`

Explorers:

- Minter: `https://tonscan.org/address/EQDO5Wl-jFR2A9UrgZZKqQbV_2Ab56HZqMbVbj3G2noXJq3Y`
- Vesting Controller: `https://tonscan.org/address/EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot`

## Deployment Wallet

- Deployer wallet used by Blueprint: `UQCxJ05yeawVWlsN5SfJ-obajgh2lFffR-O7ebH_s_wqQfRq`

## Configured Mainnet Wallets

- Initial circulation wallet: `UQBv9pBWH7R_gv2mGYXKwGX59S6RH7wuramDTRyb8OUqoycQ`
- Official reserve wallet: `UQDo48rWrpPU9ouJk5ZoKzTFPHUfqt1tZEKvtFE73xcyGZFA`
- Team wallet: `UQAXy5kyjrLT2mgIOB_AbhalM4R-ZL_bM2QjyY6hTS1FfktJ`
- Emergency rescue wallet: `UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R`
- Admin wallet: `UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD`
- Price admin wallet: `UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD`
- Treasury wallet: `UQDDSkodFARAsYCVSzE9MgMrYk44PF95UyZcYwLDFnkXskXp`

## Post-Deployment Verification

Verified by mainnet get-method reads after deployment:

- `totalSupply`: `10000000000000000000`
- `mintable`: `false`
- Vesting `funded`: `true`
- Vesting `saleActive`: `true`
- Vesting `saleFinalized`: `false`
- Vesting `paused`: `false`
- Emergency rescue address: `EQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBDPU`
- Initial circulation Jetton wallet: `EQBF-NikJXEZYtMQP5LNosPDUHLgTESu8P-wIPSDHTLGIErs`
- Initial circulation DIAO balance: `1000000000000000000`
- Vesting Jetton wallet: `EQD5Hszpgj50w6EstdOliVvxMPbVDZN0NuJqHi5J1YtrDcN2`
- Vesting DIAO balance: `9000000000000000000`
- Minter content marker: `1`
- Minter metadata URL: `https://ivory-keen-perch-796.mypinata.cloud/ipfs/bafkreigsnrrxhqvxhst2xay7pythep5auoprv3ekuzruyp77jwtqjgp4im`
- Vesting native coin balance after deployment verification: `0.37377286`
- Max withdrawable while preserving `0.05`: `0.32377286`
- Total packages sold at verification time: `0`

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

## Deployment Notes

- `init_mint` used the testnet-verified funding values:
  - initial circulation leg: `0.15 TON`
  - vesting controller leg: `0.35 TON`
  - total init message value: `0.8 TON`
- Blueprint printed its known `readline was closed` teardown message after deployment completed. Contract deployment and verification succeeded.
