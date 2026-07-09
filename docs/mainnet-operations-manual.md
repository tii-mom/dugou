# DIAO Mainnet Operations Manual

Status: pre-mainnet runbook. Do not execute mainnet deployment until owner approval.

## Fixed Addresses

- Initial circulation wallet: `UQBv9pBWH7R_gv2mGYXKwGX59S6RH7wuramDTRyb8OUqoycQ`
- Official reserve wallet: `UQDo48rWrpPU9ouJk5ZoKzTFPHUfqt1tZEKvtFE73xcyGZFA`
- Team wallet: `UQAXy5kyjrLT2mgIOB_AbhalM4R-ZL_bM2QjyY6hTS1FfktJ`
- Emergency rescue wallet: `UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R`
- Admin wallet: `UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD`
- Price admin wallet: `UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD`
- Treasury wallet: `UQDDSkodFARAsYCVSzE9MgMrYk44PF95UyZcYwLDFnkXskXp`

## Deployment

1. Confirm the deployer wallet is connected to mainnet and has enough TON for deployment.
2. Confirm `.env` does not set mainnet-unsafe overrides:
   - Do not set `DIAO_TESTNET_DEPLOY_SALT` for mainnet.
   - Do not set `DIAO_TESTNET_WALLET` for mainnet.
3. Run local verification:

```bash
cd /Users/yu1/Desktop/GOU/contracts
npm test -- --runInBand
npx blueprint build --all
```

4. Deploy only after final owner approval:

```bash
cd /Users/yu1/Desktop/GOU/contracts
npx blueprint run deployDIAOJettonMinter --mainnet
```

The deployment script performs this order:

1. Deploy DIAO Jetton Minter.
2. Deploy DIAO Vesting Controller.
3. Call `init_mint` to mint 1B DIAO to the initial circulation wallet and 9B DIAO to the vesting controller.
4. Transfer minter admin to the configured admin wallet.

Current `init_mint` funding in the deployment script:

- Initial circulation leg: `0.15 TON`
- Vesting controller leg: `0.35 TON`
- Total `init_mint` message value: `0.8 TON`

These values were verified on testnet after a lower `0.18 TON` vesting leg failed to mark the vesting controller as funded.

## Post-Deployment Checks

Immediately after deployment, verify:

- Minter address and Vesting Controller address are recorded.
- Minter `totalSupply` is exactly `10,000,000,000 DIAO`.
- Minter `mintable` is `false`.
- Initial circulation wallet received `1,000,000,000 DIAO`.
- Vesting Controller Jetton wallet received `9,000,000,000 DIAO`.
- Vesting Controller `funded` is `true`.
- Vesting Controller `saleActive` is `true`.
- Vesting Controller `saleFinalized` is `false`.
- Vesting Controller `paused` is `false`.
- `emergencyRescueAddress` is `UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R`.
- Metadata URL resolves and displays the correct name, symbol, description, and image.

## Pause And Resume

Use admin action `3` to pause.

Effects while paused:

- Buying is blocked.
- Price submission is blocked.
- Unlock execution is blocked.
- Buyer, reserve, and team claims are blocked.
- Admin can still unpause, update price admin, withdraw TON, and execute emergency DIAO rescue.

Use admin action `4` to unpause.

## TON Withdrawal

Only the admin wallet can withdraw TON from the Vesting Controller.

Rules:

- TON is sent only to the treasury wallet.
- Withdrawal must preserve at least `0.05 TON` inside the controller.
- User gas remains user-paid; the platform does not subsidize buyer or claim gas.

Mainnet status command:

```bash
cd /Users/yu1/Desktop/GOU/contracts
npx ts-node scripts/statusMainnetDIAO.ts
```

Mainnet withdrawal command:

```bash
cd /Users/yu1/Desktop/GOU/contracts
npx blueprint run operateMainnetDIAO --mainnet withdraw-ton <amount>
```

Example:

```bash
npx blueprint run operateMainnetDIAO --mainnet withdraw-ton 100
```

This sends `<amount>` native coin from the Vesting Controller to the treasury wallet. The transaction is initiated by Blueprint and must be confirmed in the connected admin wallet. The script checks that the connected wallet is the on-chain admin before sending any write transaction.

Mainnet admin command:

```bash
npx blueprint run operateMainnetDIAO --mainnet admin <action>
```

Actions:

- `1`: close sale
- `2`: open sale
- `3`: pause
- `4`: unpause
- `7`: finalize sale

Mainnet unlock commands:

```bash
npx blueprint run operateMainnetDIAO --mainnet submit-price <round> [price]
npx blueprint run operateMainnetDIAO --mainnet execute-unlock
```

## Emergency DIAO Rescue

Purpose: recover only unsold or unclaimable DIAO in extreme cases, without touching sold buyer entitlement.

Rules:

- Admin-only.
- Controller must be paused.
- Controller must be funded.
- Recipient must be the dedicated emergency rescue wallet:
  `UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R`
- Maximum rescue amount:
  `unclaimed official reserve remainder + unclaimed team allocation - previous emergency rescues`
- Sold buyer entitlement is excluded from the rescueable amount.

Operational sequence:

1. Pause the controller.
2. Calculate the rescueable amount from current sale, reserve claim, team claim, and previous rescue state.
3. Send `EmergencyRescueDiao` to the controller with the dedicated rescue wallet as recipient.
4. Verify the rescue wallet Jetton balance increased.
5. Verify the Vesting Controller still holds all sold buyer locked entitlement.

## Price Submission And Unlock

Unlocks are sequential and one transaction unlocks one round.

1. Price admin submits price for `currentUnlockedRound + 1`.
2. Wait at least `24 hours` after submission.
3. Execute unlock before price validity expires at `48 hours`.
4. If price expires, submit a fresh price for the same next round.

Rules:

- Round cannot be skipped.
- Same pending round cannot be overwritten.
- Submitted price must meet or exceed the target round price.
- Anyone can execute the unlock after a valid price has passed the cooldown.

## Claiming

- Buyers can claim only rounds 1-15.
- Official reserve can claim only after sale finalization and only rounds 1-15 remainder.
- Team can claim only rounds 16-18.
- Sale close/open only affects new purchases. Existing buyers can still claim after sale close.
- `finalize_sale` is irreversible and enables official reserve claims.
