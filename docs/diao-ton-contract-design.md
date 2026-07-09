# DIAO TON Contract Design

## 1. Scope

DIAO is a TON Jetton with a fixed total supply of `10,000,000,000 DIAO`.

The intended release model is price-milestone based:

- `1,000,000,000 DIAO` unlocks immediately after deployment for initial circulation.
- `9,000,000,000 DIAO` remains locked.
- Locked supply unlocks in `18` milestone rounds of `500,000,000 DIAO`.
- Each milestone doubles the previous unlock price, starting from an initial reference price of `$0.00001`.
- Rounds 1-15 are reserved for 58 TON package buyer unlock rewards. Any unsold remainder from each unlocked round goes to the official reserve wallet.
- Rounds 16-18 unlock to the team wallet.

This document is the contract-level design target. It is not an audit report.

## 2. Current TON Tooling Direction

As of July 2026, the recommended new-contract path should be:

- Language: **Tolk** for new low-level TON contracts.
- Framework: **Blueprint** for project scaffold, build, tests, deployment scripts, and Sandbox tests.
- Token standard: TON **Jetton** standard for fungible tokens.

Tact should not be selected as the primary language for a new contract unless there is a specific maintenance reason. The Tact docs currently direct new development toward Tolk.

## 3. Contract Set

The system should be split into two business contracts, plus the standard Jetton wallet implementation required by the TON Jetton standard:

1. `DIAOJettonMinter`
   - Jetton master contract.
   - Fixed max supply: `10,000,000,000 DIAO`.
   - Deploys fixed supply once and disables arbitrary future minting.
   - Exposes standard Jetton metadata and wallet discovery.

Standard implementation: `DIAOJettonWallet`
   - Standard Jetton wallet implementation.
   - Should stay compatible with TON wallets, explorers, and DEX integrations.

2. `DIAOVestingController`
   - Owns the locked supply authority.
   - Receives `9,000,000,000 DIAO` after deployment.
   - Handles 58 TON package purchases.
   - Records package entitlements.
   - Stores current unlocked round.
   - Verifies that a price milestone has been reached.
   - Releases buyer, reserve, and team allocations.
   - Prevents double unlock.

## 4. Token Supply

DIAO uses fixed Jetton precision of `9` decimals. This is a frozen token parameter.

```text
1 DIAO = 1_000_000_000 base units
total_supply = 10_000_000_000 * 1_000_000_000
```

Supply buckets:

| Bucket | DIAO | Notes |
| --- | ---: | --- |
| Initial circulation | 1,000,000,000 | Transferred after deployment to the initial circulation wallet |
| Buyer package pool and rounds 1-15 reserve | 7,500,000,000 | Covers buyer immediate release, buyer round claims, and official reserve remainder |
| Team rounds 16-18 | 1,500,000,000 | 3 rounds * 500,000,000 to team wallet after unlock |
| Total | 10,000,000,000 | Fixed cap |

## 5. Unlock Schedule

Initial reference price: `$0.00001`.

| Round | Unlock Price USD | Allocation | Recipient |
| ---: | ---: | ---: | --- |
| 1 | 0.00002 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 2 | 0.00004 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 3 | 0.00008 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 4 | 0.00016 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 5 | 0.00032 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 6 | 0.00064 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 7 | 0.00128 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 8 | 0.00256 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 9 | 0.00512 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 10 | 0.01024 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 11 | 0.02048 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 12 | 0.04096 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 13 | 0.08192 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 14 | 0.16384 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 15 | 0.32768 | 500,000,000 DIAO | 58 TON buyers, remainder to official reserve |
| 16 | 0.65536 | 500,000,000 DIAO | Team wallet |
| 17 | 1.31072 | 500,000,000 DIAO | Team wallet |
| 18 | 2.62144 | 500,000,000 DIAO | Team wallet |

Store unlock prices as integer micro-USD or nano-USD, not floating point.

Recommended:

```text
price_scale = 1_000_000_000_000
initial_price = 0.00001 * price_scale = 10_000_000
round_price(round) = initial_price * 2^round
```

## 6. Price Oracle Requirement

The unlock condition should start simple, but should not let a single arbitrary price input instantly unlock supply.

Recommended two-phase model:

### Phase 1: Manual Price Feed

- `price_admin_wallet` submits DIAO/USD observations manually.
- The observation should come from the TON liquidity pool price plus project operations review.
- Manual price updates store:
  - `price`
  - `source_type`
  - `observed_at`
  - `valid_until`
  - `target_round`
- A submitted price does not immediately release tokens.
- After a price update, the contract requires an unlock cooldown, recommended `24 hours`.
- During cooldown, the frontend and community can see the pending unlock round before execution.

### Phase 2: Automated Pool Oracle

- After the liquidity pool is stable, replace or supplement manual updates with an oracle contract.
- The oracle should read a TWAP/VWAP-style pool price when supported by the chosen TON DEX infrastructure.
- The admin wallet should be able to switch the accepted price source from manual to oracle.

Minimum operating thresholds:

- Manual price update cooldown: `24 hours`.
- Manual price update validity: `48 hours`.
- If reliable on-chain TWAP is unavailable, the admin script can compute a 24-hour TWAP/VWAP off-chain and submit only the final observation.
- No minimum liquidity threshold is enforced by the first implementation.

The vesting contract rejects:

- stale price observations
- observations below the target price
- attempts to unlock a non-sequential round
- attempts to unlock the same round twice

Operational policy:

- Only one round can unlock per transaction.
- Rounds must unlock sequentially.
- If the market price jumps across multiple milestones, operators submit one proof per round over time.
- Each proof should target a 24-hour TWAP/VWAP-style observation. No minimum liquidity threshold is enforced in v1.

This is slower than catch-up unlocking, but it is safer for operations, easier to audit, and avoids dumping several unlock rounds into the market at once.

## 7. Participant Package

"赌狗翻身仗" package:

- Price: `58 TON`.
- Immediate amount: `200,000 DIAO`.
- Locked entitlement: `3,000,000 DIAO`.
- Locked entitlement releases over rounds 1-15.
- Per-round package release: `200,000 DIAO`.
- Total per package: `3,200,000 DIAO`.
- Max packages per wallet: `10`.

Frontend purchase UX:

- The frontend presents package count selection only.
- The user cannot type an arbitrary TON amount.
- Package count range: `1` to `10`, capped by remaining wallet allowance and total sale availability.

Contract-side payment rule:

- The sale contract still validates the received TON amount defensively.
- It accepts only exact integer package payments: `58 TON * package_count`.
- `package_count` must be between `1` and `10`.
- If a wallet already owns packages, the new purchase cannot push the wallet above `10`.
- Invalid or insufficient payments should be rejected or refunded according to TON message-handling best practice.
- Any excess value beyond the exact package price should be returned when practical after retaining required gas.

Gas policy:

- Users pay gas for package purchase.
- Users pay gas for each claim.
- Users pay gas for other platform interactions.
- The platform does not subsidize user gas.

Per-wallet maximum:

```text
max packages = 10
immediate max = 2,000,000 DIAO
locked max = 30,000,000 DIAO
total max = 32,000,000 DIAO
per-round max = 2,000,000 DIAO
```

Important supply constraint:

Rounds 1-15 contain `7,500,000,000 DIAO` total. Each package consumes `3,000,000 DIAO` locked entitlement.

```text
mathematical max packages = 7,500,000,000 / 3,000,000 = 2,500 packages
operational sale cap = 2,000 packages
reserved unsold package capacity = 500 packages
```

Therefore, the sale contract must enforce:

- `total_packages_sold <= 2,000`
- `wallet_packages[address] <= 10`
- `msg_value` must cover exact package price plus execution gas

The recommended operational rule is first-come-first-served until either:

- `2,000` packages are sold, or
- the admin wallet closes the sale.

Do not increase the 2,000 package cap unless the token allocation is changed and re-audited.

Immediate release is paid by the vesting controller:

```text
2,000 packages * 200,000 DIAO = 400,000,000 DIAO
```

The immediate purchase amount can come from the `9,000,000,000 DIAO` held by `DIAOVestingController`. This keeps the system to two contracts and avoids a separate sale reserve contract.

Recommended initial circulation:

| Use | DIAO |
| --- | ---: |
| Initial circulation wallet | 1,000,000,000 |
| Total initial circulation | 1,000,000,000 |

The project can use the initial circulation wallet for DEX liquidity, market start, and operations. Buyer immediate distribution is handled separately by `DIAOVestingController`.

## 8. Participant Distribution Method

Rounds 1-15 only cover 58 TON package buyers. App users who upload screenshots, invite users, rank on leaderboards, or join off-chain campaigns are not included in this contract unlock right unless they also bought a 58 TON package.

Do not make the contract iterate over all buyers. TON contracts should avoid unbounded loops and mass transfers because gas and message fan-out will fail at scale.

Use per-wallet claim accounting.

The sale contract stores:

- packages purchased per wallet
- highest claimed round per wallet

When a round unlocks, each wallet calls `claim(round)` and receives:

```text
claimable = packages_purchased * 200,000 DIAO * unclaimed_unlocked_rounds
```

This is simple when participants only come from the 58 TON package sale.

### Round Remainder

The buyer and official reserve budget for rounds 1-15 is `7,500,000,000 DIAO`.

Buyer requirement at the `2,000` package cap:

```text
buyer_immediate_total = total_packages_sold * 200,000 DIAO
buyer_locked_total = total_packages_sold * 3,000,000 DIAO
buyer_total = buyer_immediate_total + buyer_locked_total
official_reserve_total = 7,500,000,000 DIAO - buyer_total
```

If all `2,000` packages sell:

```text
buyer_immediate_total = 2,000 * 200,000 DIAO = 400,000,000 DIAO
buyer_locked_total = 2,000 * 3,000,000 DIAO = 6,000,000,000 DIAO
buyer_total = 6,400,000,000 DIAO
official_reserve_total = 1,100,000,000 DIAO
```

The implementation should release official reserve over rounds 1-15 using a deterministic formula so the total pool remains exactly `7,500,000,000 DIAO`. A simple option is to let the official reserve wallet claim:

```text
reserve_claimable_after_round_n =
  floor(official_reserve_total * n / 15) - reserve_already_claimed
```

Round 16 is not part of buyer vesting. It unlocks to the team wallet.

Implementation detail:

- Buyer claims should stay available for a long period, preferably forever.
- Community reserve should only be able to claim the mathematically unsold remainder, not buyer allocations.
- If the product wants unclaimed buyer rewards to eventually become community rewards, add a clear expiry such as 36 months after each round unlock. This is more complex and should be disclosed before sale.

Recommended default: no expiry for buyer claims.

## 9. Wallet and Reserve Rules

Configured wallets:

| Role | Address | Purpose |
| --- | --- | --- |
| `initial_circulation_wallet` | `UQBv9pBWH7R_gv2mGYXKwGX59S6RH7wuramDTRyb8OUqoycQ` | Receives initial `1,000,000,000 DIAO` after deployment |
| `official_reserve_wallet` | `UQDo48rWrpPU9ouJk5ZoKzTFPHUfqt1tZEKvtFE73xcyGZFA` | Receives rounds 1-15 official reserve remainder |
| `team_wallet` | `UQAXy5kyjrLT2mgIOB_AbhalM4R-ZL_bM2QjyY6hTS1FfktJ` | Receives rounds 16-18 team DIAO |
| `admin_wallet` | `UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD` | Opens/closes sale, pauses, withdraws TON, switches price feed |
| `price_admin_wallet` | `UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD` | Submits manual DIAO/USD price observations in v1 |
| `treasury_wallet` | `UQDDSkodFARAsYCVSzE9MgMrYk44PF95UyZcYwLDFnkXskXp` | Receives TON withdrawn from the vesting controller |

Rounds 17 and 18:

- Unlock only after price milestones are proven.
- Mint or transfer `500,000,000 DIAO` per round to `team_wallet`.
- `team_wallet` is a configured single wallet address.

Recommended controls:

- `team_wallet` receives rounds 16-18 after price milestones.
- `treasury_wallet` for TON proceeds separate from `team_wallet`.
- `official_reserve_wallet` separate from `team_wallet`.
- `price_admin_wallet` can submit manual price updates before the automated liquidity-pool oracle is ready.

No contract role uses multisig in the current product requirement. This keeps code and operations simple, but it also means wallet key management is a major operational risk.

Community reserve use cases:

- user rewards
- testing incentives
- ecosystem partnerships
- liquidity or campaign support if approved by the admin wallet

Official reserve tokens should not be routed directly to the team wallet by contract logic.

## 10. Admin and Safety Controls

Minimum roles:

- `admin_wallet`: can pause sale, close sale, withdraw TON proceeds, update the price admin, and update metadata if mutable metadata is needed.
- `treasury_wallet`: receives TON sale proceeds.
- `team_wallet`: receives rounds 16-18.
- `official_reserve_wallet`: receives official reserve remainder from rounds 1-15.
- `price_admin_wallet`: submits manual DIAO/USD price updates during phase 1.
- `oracle_contract`: optional future automated pool-price oracle during phase 2.

Recommended safety features:

- Fixed max supply hardcoded or stored once at deployment and never increaseable.
- Pausable sale before final decentralization.
- No owner mint after initialization except through vesting controller.
- No arbitrary user balance changes.
- Emergency pause for purchases and claims, but not permanent confiscation.
- TON proceeds in `DIAOVestingController` are withdrawable only to the configured `treasury_wallet`.
- Events/messages for purchases, round unlocks, and claims.

## 11. Final Operating Decisions

These are the recommended defaults for implementation:

1. Contract count: two contracts, `DIAOJettonMinter` and `DIAOVestingController`.
2. Eligible unlock participants: only wallets that bought 58 TON packages.
3. App activity rewards: handled separately from this vesting contract, through official reserve campaigns.
4. DIAO/USD price source phase 1: `price_admin_wallet` manually submits DIAO/USD observations from the TON liquidity pool and project operations data.
5. DIAO/USD price source phase 2: switch to an automated liquidity-pool oracle after liquidity is stable and the oracle contract is tested.
6. Manual price feed: 24-hour cooldown, 48-hour validity, no minimum liquidity threshold in v1.
7. Multi-round jumps: unlock one round per transaction, sequentially.
8. Sale cap: hard cap of `2,000` packages.
9. Wallet cap: hard cap of `10` packages per wallet.
10. Sale starts open after deployment; admin wallet can close and reopen sale.
11. Sale close: stops new purchases only, does not affect buyer claims.
12. Buyer claims: no expiry by default.
13. Official reserve remainder: claimable by `official_reserve_wallet` according to the deterministic rounds 1-15 formula.
14. Team wallet: single configured wallet, unlockable only after rounds 16-18 price milestones are reached.

## 12. Frozen Parameter Table

```text
symbol = DIAO
decimals = 9
total_supply = 10,000,000,000 DIAO
initial_unlock = 1,000,000,000 DIAO
locked_supply = 9,000,000,000 DIAO
initial_price_usd = 0.00001
round_count = 18
round_allocation = 500,000,000 DIAO
package_price = 58 TON
package_immediate = 200,000 DIAO
package_locked = 3,000,000 DIAO
package_total = 3,200,000 DIAO
max_packages_total = 2,000
max_packages_per_wallet = 10
buyer_rounds = 1-15
buyer_release_per_round = 200,000 DIAO/package
official_reserve_rounds = 1-15
team_rounds = 16-18
price_feed_phase_1 = manual price_admin_wallet
price_feed_phase_2 = automated pool oracle
manual_price_cooldown = 24 hours
manual_price_validity = 48 hours
minimum_liquidity_threshold = none in v1
unlock_policy = sequential, one round per transaction
user_gas_policy = users pay all gas
sale_starts_open = true
sale_ton_withdrawal = treasury_wallet only
initial_circulation_wallet = UQBv9pBWH7R_gv2mGYXKwGX59S6RH7wuramDTRyb8OUqoycQ
official_reserve_wallet = UQDo48rWrpPU9ouJk5ZoKzTFPHUfqt1tZEKvtFE73xcyGZFA
team_wallet = UQAXy5kyjrLT2mgIOB_AbhalM4R-ZL_bM2QjyY6hTS1FfktJ
admin_wallet = UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD
price_admin_wallet = UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD
treasury_wallet = UQDDSkodFARAsYCVSzE9MgMrYk44PF95UyZcYwLDFnkXskXp
```

## 13. Suggested Repository Layout

When adding contracts to this repo, keep the frontend and contracts separated:

```text
contracts/
  package.json
  blueprint.config.ts
  contracts/
    diao_jetton_minter.tolk
    diao_jetton_wallet.tolk
    diao_vesting_controller.tolk
  wrappers/
    DIAOJettonMinter.ts
    DIAOVestingController.ts
  tests/
    diao_purchase.spec.ts
    diao_unlock.spec.ts
    diao_supply.spec.ts
  scripts/
    deploy.ts
```

## 14. Test Requirements

Before deployment, write Sandbox tests for:

- total supply never exceeds `10,000,000,000 DIAO`
- token decimals are fixed at `9`
- deployment mints exactly `1,000,000,000 DIAO`
- deployment transfers `9,000,000,000 DIAO` to `DIAOVestingController`
- sale is open immediately after deployment
- package purchase requires exactly `58 TON`
- wallet cannot buy more than `10` packages
- total package cap is `2,000`
- immediate package transfer is `200,000 DIAO`
- locked package entitlement is `3,000,000 DIAO`
- total package entitlement is `3,200,000 DIAO`
- each round claim is `200,000 DIAO` per package for rounds 1-15
- round cannot unlock below target price
- round cannot unlock immediately after manual price submission if cooldown has not passed
- manual price observation expires after `48 hours`
- round cannot unlock twice
- team cannot receive rounds 1-15
- official reserve receives only deterministic remainder from rounds 1-15
- participants cannot claim rounds 16-18
- team receives rounds 16-18 only after milestones
- oracle proof replay fails
- TON proceeds can only be withdrawn to `treasury_wallet`
- only `admin_wallet` can close sale, reopen sale, pause sale, and withdraw TON proceeds
- only `price_admin_wallet` or approved oracle source can submit accepted price observations

## 15. Main Risk Summary

- Price milestone releases are only as trustworthy as the oracle.
- A thin-liquidity token price can be manipulated to trigger unlocks.
- Only 58 TON buyers are eligible for rounds 1-15 buyer rewards.
- Mass distribution must use user claims, not contract-side batch transfers.
- The 58 TON package has an operational hard sale cap of `2,000` packages, leaving `500` package capacity reserved for community allocation.
- Official reserve and team allocations should be explicitly routed to their configured wallets to avoid future disputes.
