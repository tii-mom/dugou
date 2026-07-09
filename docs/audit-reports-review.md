# DIAO Audit Reports Review

Date: 2026-07-09

This document reviews three external audit-style reports provided for the DIAO TON contracts and classifies each finding as valid, partially valid, false positive, or accepted risk.

## Input Reports

1. `deep-research-report (1).md`
2. `Qwen_markdown_20260709_40xtw9s2g.md`
3. `pasted-text.txt` / Tabbit AI Audit report

## Executive Conclusion

The three reports disagree materially:

- Report 1 is conservative and correctly highlights TON asynchronous-message consistency as the main risk.
- Report 2 is optimistic and treats bounce risks as low-probability accepted risks.
- Report 3 contains one severe false positive about forged funding, but also flags useful hardening items.

My engineering recommendation: do not ignore the asynchronous failure findings. Before mainnet, either fix the controller/minter bounce-consistency risks or get a professional TON auditor to explicitly sign off that the current gas budgets and message paths make those risks acceptable.

## Consolidated Findings

| ID | Source | Finding | Review | Recommended Action |
|---|---|---|---|---|
| R1-F01 | Report 1 | `init_mint` locks minter before both initial transfers are fully confirmed. A bounce can leave supply accounting locked/incomplete. | Valid class of TON async risk. Severity depends on whether action/bounce paths can realistically fail with deployment gas. Current implementation has no bounce recovery. | Treat as High/P0 review item. Ask auditor to verify action-phase and bounce behavior. Prefer increasing init funding and adding explicit deployment verification/retry design. |
| R1-F02 | Report 1 | Buy/claim paths update state before Jetton transfer succeeds; controller `onBouncedMessage` does not restore business state. | Valid. If the message from controller to vesting Jetton wallet bounces due low TON or action failure, claim/purchase state can advance without delivery. Downstream recipient bounce restores Jetton wallet balance, but controller state still does not roll back. | Treat as High. Add bounce/failure tests. Consider pending-state or strict gas minimums and bounce recovery. |
| R1-F03 | Report 1 | Admin and price admin are same single-signature wallet. | Valid operational/governance risk, but currently by explicit project design. | Accept only if owner signs off. Strongly recommend multisig before meaningful mainnet funds. |
| R1-F04 | Report 1 | Price admin can overwrite same pending round and reset cooldown. | Valid governance/fairness issue. Current code allows submitting `targetRound == currentUnlockedRound + 1` repeatedly while pending. | Fix before mainnet or document as trusted-admin behavior. Best fix: reject `SubmitPrice` when `pendingRound != 0`. |
| R1-F05 | Report 1 | TON withdrawal leaves only `0.05 TON`, potentially too low for future operation/rent. | Valid availability issue, but project owner accepts `0.05 TON` reserve because current TON gas is far below 0.001 TON and contract interactions are user-funded. | Keep `0.05 TON` reserve as accepted operational risk; monitor contract TON balance after launch. |
| R1-F06 | Report 1 | Metadata can be changed by minter admin and depends on Pinata gateway. | Partially valid. `ChangeMinterContent` remains admin-controlled after minting; admin cannot mint but can alter content. | Decide whether metadata mutability is intended. If not, remove content change or transfer admin to burn/zero/multisig/timelock. Use multiple pins/gateways. |
| R1-F08 | Report 1 | Tests do not cover bounce/failure/reordering sufficiently. | Valid. Existing tests cover normal and many permission paths, not enough async fault injection. | Add tests for bounced `AskToTransfer`, insufficient claim TON, failed init legs, malformed admin payload. |
| R2-F01 | Report 2 | Minter init bounce risk is Low/accepted because gas is sufficient. | Partially valid but too optimistic. Gas sufficiency reduces probability; it does not remove the lack of recovery. | Keep as High review item until a TON auditor signs off or recovery is implemented. |
| R2-F02 | Report 2 | Vesting buy immediate release bounce risk is Low/accepted. | Too optimistic. User-triggered low-gas edge cases can consume business state if transfer bounces. | Add contract-level gas minimums and bounce tests. |
| R2-F03 | Report 2 | Admin centralization is by design. | Valid as design statement, not a security mitigation. | Needs explicit owner sign-off and public disclosure. |
| R2-F04 | Report 2 | Reserve integer division is a positive design; final round absorbs remainders. | Correct. At `n=15`, `(totalReservePool * 15) / 15 == totalReservePool`. | No fix needed. |
| R3-Critical-01 | Report 3 | Attacker can forge Jetton transfer notification and set `funded=true`. | Likely false positive. `isSenderVestingWallet()` requires sender to be the deterministic Jetton wallet address derived from the actual minter and wallet code. An attacker cannot deploy arbitrary fake code at that address. A legitimate Jetton wallet at that address cannot send arbitrary notifications without satisfying wallet logic. | Ask external auditor to confirm, but do not treat as Critical based on current reasoning. Adding `!funded` guard is harmless but does not address a real exploit path. |
| R3-High-02 | Report 3 | `mintable=false` before wallet deployment can lock supply if bounce occurs. | Same as R1-F01. Valid risk class. | High/P0 review item. |
| R3-High-03 | Report 3 | `AdminControl` action 5/6 payload parsing can underflow on malformed payload; action 5 and 6 duplicate same field. | Partially valid. A malformed admin transaction fails and burns gas, but does not brick the contract. Duplicate action names are confusing. | Low/Medium hardening. Add explicit payload validation and remove/rename duplicate action 6. |
| R3-Low-04 | Report 3 | Reserve precision loss leaves final dust. | False positive. At round 15, formula returns full `totalReservePool`; no dust remains from division. | No fix needed. |

## Recommended Mainnet Blockers

Do not deploy mainnet until these are resolved or formally accepted in writing:

1. Async state consistency for `init_mint`.
2. Async state consistency for `BuyPackage`, `ClaimBuyer`, `ClaimReserve`, `ClaimTeam`.
3. Pending price overwrite behavior.
4. Admin/price-admin single-signature risk acceptance.
5. TON reserve after withdrawal.

## Suggested Fix List

### P0 / Mainnet Blocker

1. Add tests that intentionally make controller-to-Jetton-wallet transfer fail after state update.
2. Either implement bounce recovery/pending states or raise and prove gas minimums for all transfer paths.
3. Add explicit deployment verification after `init_mint`: total supply, circulation wallet balance, vesting wallet balance, vesting `funded=true`, minter `mintable=false`.
4. Consider increasing init mint TON amounts:
   - `initialCirculationTonAmount`
   - `vestingControllerTonAmount`
   - total `value` sent to `init_mint`

### P1 / Strongly Recommended Before Mainnet

1. Reject `SubmitPrice` if another `pendingRound` exists.
2. Increase controller TON reserve for `WithdrawTon`.
3. Add `AdminControl` payload validation and remove or document duplicated action 5/6.
4. Separate admin and price admin, ideally multisig.

### P2 / Documentation or Governance

1. Decide whether minter metadata can remain mutable.
2. Add public risk disclosure for manual price feed and single-wallet governance if kept.
3. Remove local filesystem paths from externally shared audit packs if needed.

## Current Position

The system has strong normal-path tests and successful testnet execution, but the most important remaining question is TON asynchronous failure safety. A professional TON auditor should specifically review message bounce/action-phase semantics and either approve the current design with gas assumptions or require the P0 fixes above.

## Fix Pass 2026-07-09

Implemented hardening:

- `SubmitPrice` now rejects a new price submission while `pendingRound != 0`.
- `WithdrawTon` now uses an explicit `MIN_CONTROLLER_TON_RESERVE = 0.05 TON` constant. The owner rejected a higher 0.5 TON reserve to avoid trapping excess TON in the controller.
- `AdminControl` action 5 now validates that an address payload is present before parsing.
- Duplicated action 6 behavior was removed; unknown admin actions now fail with `ERR_INVALID_ADMIN_ACTION = 120`.
- Deployment script now sends the testnet-verified `init_mint` funding: 0.15 TON to the initial circulation leg, 0.35 TON to the vesting leg, and 0.8 TON total value. The previous 0.18 TON vesting leg failed on testnet with `totalSupply=10B`, `mintable=false`, but `vesting funded=false`; the 0.35 TON vesting leg subsequently verified successfully.
- Added `EmergencyRescueDiao` as an accepted emergency-control mechanism: admin-only, available only while paused, recipient restricted to the dedicated emergency rescue wallet `UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R`, and capped to unsold/unclaimed reserve plus unclaimed team allocation. It tracks cumulative rescued DIAO and intentionally excludes sold buyer entitlement.
- Added tests for duplicate pending price submission, malformed admin payload, unknown admin action, withdrawal reserve enforcement, and emergency DIAO rescue boundaries.

Verification after fix:

- `npm test -- --runInBand`: 19 tests passed.
- `npx blueprint build --all`: all contracts compiled; Blueprint still prints its known readline teardown message after artifacts are written.
- Testnet deployment with 0.15/0.35/0.8 TON init funding verified `funded=true`, 1B DIAO in the circulation wallet, and 9B DIAO in the vesting wallet.
- Testnet smoke verified one 58 TON package purchase, admin pause, and `rescue-diao 1` to the configured emergency rescue wallet.

Still requiring TON-specialist review:

- Whether the remaining `init_mint` action/bounce risk is acceptable with the increased TON budget and post-deploy verification, or whether two-phase initialization is required.
- Whether controller claim/purchase state-before-transfer is acceptable under the strengthened gas assumptions, or whether a full pending/ack state machine is required.
- Whether a `0.05 TON` controller withdrawal reserve is sufficient for mainnet storage/rent and emergency operations.
- Whether the emergency rescue cap is sufficient under all combinations of sold packages, reserve claims, team claims, and previous rescues, and whether the accepted centralization risk should be disclosed publicly before launch.
