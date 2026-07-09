# DIAO TON Contract Audit Package

Status: prepared for external security audit before mainnet deployment.  
Date: 2026-07-09  
Repository workspace: `/Users/yu1/Desktop/GOU`

## Executive Summary

DIAO is a TON Jetton with a fixed 10,000,000,000 DIAO supply and a price-milestone vesting controller. The minter performs a one-time mint: 1,000,000,000 DIAO to the initial circulation wallet and 9,000,000,000 DIAO to the vesting controller. The minter is then locked with `mintable = false`.

The vesting controller handles a 58 TON package sale, immediate buyer distribution, milestone unlocks, buyer claims, official reserve claims, team claims, admin controls, TON withdrawal to treasury, and a restricted paused-only emergency DIAO rescue path.

This document is intended for a professional audit firm. It includes the frozen mainnet configuration, expected invariants, audit scope, threat model, high-priority review checklist, known assumptions, verification already performed, deployment procedure, and complete contract source code.

## Mainnet Freeze

### Token Metadata

- Name: `DIAO`
- Symbol: `DIAO`
- Decimals: `9`
- Total supply: `10,000,000,000 DIAO`
- Metadata URL: `https://ivory-keen-perch-796.mypinata.cloud/ipfs/bafkreigsnrrxhqvxhst2xay7pythep5auoprv3ekuzruyp77jwtqjgp4im`
- Image URL: `https://ivory-keen-perch-796.mypinata.cloud/ipfs/bafybeiarg22nye43yqcgazwmibtykyuwhtslfh3xo3v5ktcml7skm7y5ve`
- Description: `DIAO（屌）是一场机会的测试，代币的解锁与价格上涨相关，持有者有机会改变他们的命运，重启人生。`

### Mainnet Wallets

- Initial circulation wallet: `UQBv9pBWH7R_gv2mGYXKwGX59S6RH7wuramDTRyb8OUqoycQ`
- Official reserve wallet: `UQDo48rWrpPU9ouJk5ZoKzTFPHUfqt1tZEKvtFE73xcyGZFA`
- Team wallet: `UQAXy5kyjrLT2mgIOB_AbhalM4R-ZL_bM2QjyY6hTS1FfktJ`
- Emergency rescue wallet: `UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R`
- Admin wallet: `UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD`
- Price admin wallet: `UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD`
- Treasury wallet: `UQDDSkodFARAsYCVSzE9MgMrYk44PF95UyZcYwLDFnkXskXp`

### Supply Allocation

- Initial circulation: `1,000,000,000 DIAO`
- Vesting controller funding: `9,000,000,000 DIAO`
- Buyer and official reserve pool: `7,500,000,000 DIAO`, rounds 1-15
- Team pool: `1,500,000,000 DIAO`, rounds 16-18
- Per-round allocation: `500,000,000 DIAO`

### Sale Rules

- Package price: `58 TON`
- Immediate buyer release per package: `200,000 DIAO`
- Locked buyer release per package: `3,000,000 DIAO`
- Total buyer entitlement per package: `3,200,000 DIAO`
- Buyer release per round: `200,000 DIAO`, rounds 1-15
- Max packages per wallet: `10`
- Max total packages: `2,000`
- Sale starts open after deployment.
- Admin can close/open sale before finalization.
- `finalize_sale` is irreversible and enables official reserve claims.

### Unlock Rules

- Initial DIAO/USD price: `0.00001`
- Round 1 unlock price: `0.00002`
- Each later round doubles the previous unlock price.
- Manual price feed cooldown: `86400 seconds` / 24 hours
- Manual price feed validity: `172800 seconds` / 48 hours
- Unlocks must be sequential.
- One transaction unlocks one round.
- Rounds 1-15 unlock buyer claims and official reserve remainder.
- Rounds 16-18 unlock team claims only.

### Emergency Controls

- Admin can pause the vesting controller.
- Pause blocks purchases, price submissions, unlock execution, and all normal claim paths.
- Admin can still unpause, update price admin, withdraw TON to treasury, and execute restricted emergency rescue while paused.
- `WithdrawTon` must preserve `0.05 TON` in the controller.
- `EmergencyRescueDiao` is admin-only and only allowed while paused.
- Emergency DIAO rescue recipient is restricted to the dedicated emergency rescue wallet: `UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R`.
- Rescue amount is capped to unsold/unclaimed official reserve plus unclaimed team allocation, minus previous emergency rescues.
- Sold buyer entitlement is excluded from the rescueable amount and must remain in the vesting controller.

## Audit Scope

Please audit the following files as in-scope:

- `contracts/contracts/diao_config.tolk`
- `contracts/contracts/diao_jetton_minter.tolk`
- `contracts/contracts/diao_jetton_wallet.tolk`
- `contracts/contracts/diao_vesting_controller.tolk`
- `contracts/wrappers/config.ts`
- `contracts/scripts/deployDIAOJettonMinter.ts`
- `contracts/wrappers/*.ts` for ABI/opcode consistency with contracts
- `contracts/tests/*.spec.ts` for coverage quality and missing edge cases

Out of scope unless requested separately:

- Frontend UX and TonConnect integration
- Backend APIs
- Off-chain price oracle automation beyond the manual price admin contract interface
- Operational custody practices, except where they affect contract permissions

## Threat Model

Actors:

- Buyer wallets purchasing 58 TON packages and claiming DIAO.
- Admin wallet controlling sale state, pause state, price admin, finalization, and TON withdrawal.
- Price admin wallet submitting milestone prices.
- Official reserve wallet claiming remainder from rounds 1-15 after sale finalization.
- Team wallet claiming rounds 16-18.
- External Jetton holders transferring/burning standard Jettons.
- Malicious callers attempting invalid opcodes, replay, insufficient gas, workchain mismatch, duplicate claims, overclaims, or unauthorized admin actions.

Important centralization assumptions:

- Admin and price admin are currently the same single-signature wallet.
- The project explicitly chose not to use multisig for these contracts.
- Manual price feed is trusted during the launch phase.

## Required Audit Questions

### Critical: Supply and Minting

- Can total supply ever exceed `10,000,000,000 DIAO`?
- Is `init_mint` truly one-time only?
- Does setting `mintable = false` before outgoing Jetton wallet messages create any partial-initialization or bounce-risk issue?
- If one of the two initial Jetton wallet deployment transfers fails or bounces, can the minter become locked while supply distribution is incomplete?
- Are bounced Jetton transfers handled safely by minter and wallet contracts?
- Can any path mint additional Jettons after `init_mint`?
- Does burn notification correctly reduce `totalSupply` only when sent by the expected Jetton wallet?

### Critical: Vesting Supply Conservation

- Does 9B DIAO in the vesting controller always decompose into buyer claims, official reserve claims, and team claims without underflow/overflow?
- Formula to verify:
  - buyer total sold entitlement = `totalPackagesSold * 3,200,000 DIAO`
  - official reserve total = `7,500,000,000 DIAO - totalPackagesSold * 3,200,000 DIAO`
  - team total = `1,500,000,000 DIAO`
- Can official reserve ever claim from the team pool?
- Can buyers ever claim rounds 16-18?
- Can team ever claim rounds 1-15?
- Can a user double-claim any buyer round?
- Can reserve or team double-claim?
- Are integer divisions in reserve linear release acceptable, and is final round 15 exact?

### Critical: Purchase Flow

- Is `packageCount` validation complete?
- Does the contract correctly enforce max 10 packages per wallet?
- Does the contract correctly enforce max 2,000 packages total?
- Does auto-finalization at 2,000 packages prevent further purchases?
- Does payment validation correctly require `packageCount * 58 TON + gas buffer`?
- Does any overpayment stay in the contract intentionally, and can admin withdraw it later?
- Does immediate 200,000 DIAO transfer per package always debit the vesting controller wallet correctly?
- If immediate Jetton transfer fails or bounces, can purchase state become inconsistent?

### Critical: Unlock and Price Feed

- Can only the price admin submit prices?
- Can admin unexpectedly change price admin to a malicious address, and is this an accepted trust model?
- Is price scaling correct for all 18 rounds?
- Does `INITIAL_PRICE_SCALED * (1 << targetRound)` fit safely in the declared integer size and message field sizes?
- Is `SubmitPrice.price: uint64` sufficient for all target prices through round 18?
- Can a stale pending round be overwritten? Is that intended?
- Does the 24h cooldown enforce `>=` correctly?
- Does the 48h validity enforce `<=` correctly?
- Can unlocks skip rounds or repeat rounds?
- Can anyone execute unlock after the trusted price admin submitted a valid price, and is that intended?

### Critical: Admin Controls

- Are all admin-only actions protected by `senderAddress == adminAddress`?
- Is `finalize_sale` irreversible?
- Can sale be reopened after finalization? It should not.
- Can pause block all intended user interactions?
- During pause, should admin withdrawals and admin recovery operations still work? Current tests expect yes.
- Are unknown admin actions safely rejected? Current code throws `ERR_INVALID_ADMIN_ACTION`.
- Can admin update price admin/source correctly through payload parsing?
- Is payload parsing for admin actions safe if payload is malformed or absent?

### Critical: Emergency DIAO Rescue

- Can emergency rescue be called only by admin?
- Is emergency rescue impossible unless the controller is paused and funded?
- Is recipient restriction to the dedicated emergency rescue wallet complete?
- Is rescue capped correctly under all combinations of sold packages, reserve claims, team claims, and previous emergency rescues?
- Can emergency rescue ever transfer DIAO that represents sold buyer entitlement?
- Does emergency rescue create any underflow if reserve/team have already claimed partially or fully?
- Does the centralization risk of admin-controlled emergency rescue need additional public disclosure or governance restrictions before mainnet?

### Critical: TON Withdrawal and Gas

- Can only admin withdraw TON?
- Does withdrawal always send to `treasuryAddress` only?
- Is the retained balance check `amount + 0.05 TON <= balance` sufficient for storage rent and future operations?
- Are user-paid gas assumptions preserved?
- Can malicious callers drain contract TON through excess/refund paths?

### Jetton Standard Compatibility

- Is the Jetton wallet implementation compatible with TON Jetton expectations used by Tonkeeper and explorers?
- Are opcodes, get methods, wallet address derivation, transfer notification, excess returns, and burn notifications standard-compatible?
- Are workchain checks sufficient?
- Is `forwardTonAmount` handling correct?
- Are storage reserve calculations sufficient for deployed Jetton wallets?

### Deployment Safety

- Confirm mainnet deployment cannot accidentally use `DIAO_TESTNET_WALLET` for all roles.
- Confirm testnet salt `DIAO_TESTNET_DEPLOY_SALT` cannot affect mainnet metadata URL.
- Confirm deployment order is safe:
  1. deploy minter
  2. deploy vesting controller
  3. call `init_mint`
  4. transfer minter admin
- Confirm minter admin transfer after lock has no unexpected ability to mint.
- Confirm enough TON is sent during `init_mint` for Jetton wallet deployment and notification to vesting.

## Known Operational Assumptions

- Admin and price admin are single-wallet addresses by project decision.
- Users pay all gas for buying and claiming.
- Manual price feed is trusted until later oracle automation is implemented.
- Sale starts open immediately after deployment.
- Official reserve can claim only after sale is finalized or sold out.
- Mainnet cooldown must be 24 hours, not the temporary 15-second testnet build.

## Verification Already Performed

Local tests:

- `npm test -- --runInBand`: 19 tests passed.
- Coverage includes supply, one-time mint, underfunded init, purchases, package limits, auto-finalize, close/open/finalize, withdraw, price cooldown, price expiry, sequential unlock, buyer/reserve/team claims, pause restrictions, permission boundaries, and 9B supply conservation.
- Additional coverage includes pending price overwrite rejection, malformed admin payload rejection, unknown admin action rejection, withdrawal reserve enforcement, and paused-only emergency DIAO rescue without touching sold buyer entitlement.

Build:

- `npx blueprint build --all` compiled all contracts successfully.
- Blueprint currently prints a CLI teardown `readline was closed` message after artifacts are written; command exits with code 0.

Testnet execution with temporary 15-second cooldown:

- Deployed DIAO minter and vesting controller.
- Verified 1B initial circulation and 9B vesting funding.
- Purchased 1 package for 58 TON.
- Verified immediate 200,000 DIAO buyer release.
- Sequentially unlocked rounds 1-18.
- Buyer claimed rounds 1-15.
- Finalized sale and claimed official reserve.
- Team claimed rounds 16-18.
- Vesting Jetton balance reached 0.

## Commands for Auditors

```bash
cd /Users/yu1/Desktop/GOU/contracts
npm install
npm test -- --runInBand
npx blueprint build --all
```

## Expected Mainnet Deployment Command

Do not run this until audit and owner approval are complete.

```bash
cd /Users/yu1/Desktop/GOU/contracts
npx blueprint run deployDIAOJettonMinter --mainnet
```

## Complete Source Code

## Source: Shared Constants

File: `contracts/contracts/diao_config.tolk`

```tolk
// DIAO Token and Vesting Constants

// Token Decimals
const DIAO_DECIMALS = 9;

// Supply buckets (in base units / nanoDIAO)
const TOTAL_SUPPLY = 10000000000000000000;       // 10,000,000,000 DIAO
const INITIAL_UNLOCK = 1000000000000000000;      // 1,000,000,000 DIAO
const LOCKED_SUPPLY = 9000000000000000000;       // 9,000,000,000 DIAO
const ROUND_ALLOCATION = 500000000000000000;     // 500,000,000 DIAO
const BUYER_AND_RESERVE_POOL = 7500000000000000000; // 7,500,000,000 DIAO (rounds 1-15)
const TEAM_TOTAL = 1500000000000000000;             // 1,500,000,000 DIAO (rounds 16-18)

// Package configuration
const PACKAGE_PRICE_TON = 58000000000;           // 58 TON (in nanoTON)
const PACKAGE_IMMEDIATE = 200000000000000;       // 200,000 DIAO
const PACKAGE_LOCKED = 3000000000000000;         // 3,000,000 DIAO
const PACKAGE_TOTAL = 3200000000000000;          // 3,200,000 DIAO
const MAX_PACKAGES_TOTAL = 2000;
const MAX_PACKAGES_PER_WALLET = 10;

// Rounds and Claims
const BUYER_RELEASE_PER_ROUND = 200000000000000; // 200,000 DIAO
const MAX_BUYER_ROUNDS = 15;
const TOTAL_ROUNDS = 18;

// Time constraints
const MANUAL_PRICE_COOLDOWN = 86400;             // 24 hours in seconds
const MANUAL_PRICE_VALIDITY = 172800;            // 48 hours in seconds
const MIN_CONTROLLER_TON_RESERVE = 50000000;     // 0.05 TON reserve after withdrawals

// Price Math
const PRICE_SCALE = 1000000000000;               // 10^12
const INITIAL_PRICE_SCALED = 10000000;           // 0.00001 * 10^12

```

## Source: DIAO Jetton Minter

File: `contracts/contracts/diao_jetton_minter.tolk`

```tolk
import "@stdlib/gas-payments"
import "diao_config"

// Error codes
const ERR_NOT_FROM_ADMIN = 73;
const ERR_UNAUTHORIZED_BURN = 74;
const ERR_NOT_ENOUGH_AMOUNT_TO_RESPOND = 75;
const ERR_MINTER_LOCKED = 76;
const ERR_INVALID_PAYLOAD = 77;

// Structs
struct MinterStorage {
    totalSupply: coins
    adminAddress: address
    content: cell
    jettonWalletCode: cell
    mintable: bool
}

fun MinterStorage.load() {
    return MinterStorage.fromCell(contract.getData())
}

fun MinterStorage.save(self) {
    contract.setData(self.toCell())
}

struct WalletStorageRef {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

fun calcDeployedJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell): AutoDeployAddress {
    val emptyWalletStorage = WalletStorageRef {
        jettonBalance: 0,
        ownerAddress,
        minterAddress
    };

    return {
        stateInit: {
            code: jettonWalletCode,
            data: emptyWalletStorage.toCell()
        }
    };
}

fun calcAddressOfJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell) {
    val jwDeployed = calcDeployedJettonWallet(ownerAddress, minterAddress, jettonWalletCode);
    return jwDeployed.calculateAddress()
}

// Opcodes & Messages
struct (0x5f616c6c) InitMint {
    queryId: uint64
    initialCirculationAddress: address
    vestingControllerAddress: address
    initialCirculationTonAmount: coins
    vestingControllerTonAmount: coins
}

struct (0x7bdd97de) BurnNotificationForMinter {
    queryId: uint64
    jettonAmount: coins
    burnInitiator: address
    sendExcessesTo: address?
}

struct (0x2c76b973) RequestWalletAddress {
    queryId: uint64
    ownerAddress: address
    includeOwnerAddress: bool
}

struct (0xd1735400) ResponseWalletAddress {
    queryId: uint64
    jettonWalletAddress: address?
    ownerAddress: Cell<address>?
}

struct (0x00000003) ChangeMinterAdmin {
    queryId: uint64
    newAdminAddress: address
}

struct (0x00000004) ChangeMinterContent {
    queryId: uint64
    newContent: cell
}

struct (0x178d4519) InternalTransferStep {
    queryId: uint64
    jettonAmount: coins
    transferInitiator: address?
    sendExcessesTo: address?
    forwardTonAmount: coins
    forwardPayload: RemainingBitsAndRefs
}

struct (0xd53276db) ReturnExcessesBack {
    queryId: uint64
}

type AllowedMessageToMinter =
    | InitMint
    | BurnNotificationForMinter
    | RequestWalletAddress
    | ChangeMinterAdmin
    | ChangeMinterContent

fun onBouncedMessage(in: InMessageBounced) {
    // Standard bounced handler can be empty since we lock minting immediately,
    // but we can skip prefix.
    in.bouncedBody.skipBouncedPrefix();
}

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessageToMinter.fromSlice(in.body);

    match (msg) {
        InitMint => {
            var storage = lazy MinterStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;
            assert (storage.mintable) throw ERR_MINTER_LOCKED;

            // Mark minter as funded and lock minting forever
            storage.totalSupply = TOTAL_SUPPLY;
            storage.mintable = false;
            storage.save();

            val emptyPayload = beginCell().endCell().beginParse();

            // 1. Send 1B DIAO to initial circulation wallet
            val intTransferCirc = InternalTransferStep {
                queryId: msg.queryId,
                jettonAmount: INITIAL_UNLOCK,
                transferInitiator: null,
                sendExcessesTo: msg.initialCirculationAddress,
                forwardTonAmount: 0,
                forwardPayload: emptyPayload
            };

            val deployCircMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: calcDeployedJettonWallet(msg.initialCirculationAddress, contract.getAddress(), storage.jettonWalletCode),
                value: msg.initialCirculationTonAmount,
                body: intTransferCirc.toCell()
            });
            deployCircMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);

            // 2. Send 9B DIAO to Vesting Controller
            val intTransferVesting = InternalTransferStep {
                queryId: msg.queryId,
                jettonAmount: LOCKED_SUPPLY,
                transferInitiator: null,
                sendExcessesTo: msg.vestingControllerAddress,
                forwardTonAmount: ton("0.05"),
                forwardPayload: emptyPayload
            };

            val deployVestingMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: calcDeployedJettonWallet(msg.vestingControllerAddress, contract.getAddress(), storage.jettonWalletCode),
                value: msg.vestingControllerTonAmount,
                body: intTransferVesting.toCell()
            });
            deployVestingMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
        }

        BurnNotificationForMinter => {
            var storage = lazy MinterStorage.load();
            assert (in.senderAddress == calcAddressOfJettonWallet(msg.burnInitiator, contract.getAddress(), storage.jettonWalletCode)) throw ERR_UNAUTHORIZED_BURN;

            assert (storage.totalSupply >= msg.jettonAmount) throw ERR_INVALID_PAYLOAD;
            storage.totalSupply -= msg.jettonAmount;
            storage.save();

            if (msg.sendExcessesTo == null) {
                return;
            }

            val excessesMsg = createMessage({
                bounce: BounceMode.NoBounce,
                dest: msg.sendExcessesTo,
                value: 0,
                body: ReturnExcessesBack {
                    queryId: msg.queryId
                }
            });
            excessesMsg.send(SEND_MODE_IGNORE_ERRORS | SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
        }

        RequestWalletAddress => {
            // ~0.01 TON minimum for respond
            assert (in.valueCoins > ton("0.01") + ton("0.01")) throw ERR_NOT_ENOUGH_AMOUNT_TO_RESPOND;

            var respondOwnerAddress: Cell<address>? = msg.includeOwnerAddress
                ? msg.ownerAddress.toCell()
                : null;

            var walletAddress: address? = null;
            if (msg.ownerAddress.getWorkchain() == BASECHAIN) {
                var storage = lazy MinterStorage.load();
                walletAddress = calcAddressOfJettonWallet(msg.ownerAddress, contract.getAddress(), storage.jettonWalletCode);
            }

            val respondMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: in.senderAddress,
                value: 0,
                body: ResponseWalletAddress {
                    queryId: msg.queryId,
                    jettonWalletAddress: walletAddress,
                    ownerAddress: respondOwnerAddress,
                }
            });
            respondMsg.send(SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
        }

        ChangeMinterAdmin => {
            var storage = lazy MinterStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;
            storage.adminAddress = msg.newAdminAddress;
            storage.save();
        }

        ChangeMinterContent => {
            var storage = lazy MinterStorage.load();
            assert (in.senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;
            storage.content = msg.newContent;
            storage.save();
        }
    }
}

struct JettonDataReply {
    totalSupply: coins
    mintable: bool
    adminAddress: address
    jettonContent: cell
    jettonWalletCode: cell
}

get fun get_jetton_data(): JettonDataReply {
    val storage = lazy MinterStorage.load();

    return JettonDataReply {
        totalSupply: storage.totalSupply,
        mintable: storage.mintable,
        adminAddress: storage.adminAddress,
        jettonContent: storage.content,
        jettonWalletCode: storage.jettonWalletCode
    };
}

get fun get_wallet_address(ownerAddress: address): address {
    val storage = lazy MinterStorage.load();
    return calcAddressOfJettonWallet(ownerAddress, contract.getAddress(), storage.jettonWalletCode);
}

```

## Source: DIAO Jetton Wallet

File: `contracts/contracts/diao_jetton_wallet.tolk`

```tolk
import "@stdlib/gas-payments"

// Error codes
const ERR_NOT_FROM_OWNER = 705;
const ERR_NOT_ENOUGH_BALANCE = 706;
const ERR_NOT_ENOUGH_TON = 709;
const ERR_INVALID_WALLET = 707;
const ERR_WRONG_WORKCHAIN = 333;
const ERR_INVALID_PAYLOAD = 708;
// BASECHAIN is already defined in stdlib

// Fees (from fees-management)
const MIN_TONS_FOR_STORAGE = ton("0.01");
const JETTON_WALLET_GAS_CONSUMPTION = ton("0.015");

// Structs
struct WalletStorage {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

fun WalletStorage.load() {
    return WalletStorage.fromCell(contract.getData())
}

fun WalletStorage.save(self) {
    contract.setData(self.toCell())
}

fun calcDeployedJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell): AutoDeployAddress {
    val emptyWalletStorage = WalletStorage {
        jettonBalance: 0,
        ownerAddress,
        minterAddress
    };

    return {
        stateInit: {
            code: jettonWalletCode,
            data: emptyWalletStorage.toCell()
        }
    };
}

fun calcAddressOfJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell) {
    val jwDeployed = calcDeployedJettonWallet(ownerAddress, minterAddress, jettonWalletCode);
    return jwDeployed.calculateAddress()
}

// Opcodes & Messages
struct (0x0f8a7ea5) AskToTransfer {
    queryId: uint64
    jettonAmount: coins
    transferRecipient: address
    sendExcessesTo: address?
    customPayload: cell?
    forwardTonAmount: coins
    forwardPayload: RemainingBitsAndRefs
}

struct (0x7362d09c) TransferNotificationForRecipient {
    queryId: uint64
    jettonAmount: coins
    transferInitiator: address?
    forwardPayload: RemainingBitsAndRefs
}

struct (0x178d4519) InternalTransferStep {
    queryId: uint64
    jettonAmount: coins
    transferInitiator: address?
    sendExcessesTo: address?
    forwardTonAmount: coins
    forwardPayload: RemainingBitsAndRefs
}

struct (0xd53276db) ReturnExcessesBack {
    queryId: uint64
}

struct (0x595f07bc) AskToBurn {
    queryId: uint64
    jettonAmount: coins
    sendExcessesTo: address?
    customPayload: cell?
}

struct (0x7bdd97de) BurnNotificationForMinter {
    queryId: uint64
    jettonAmount: coins
    burnInitiator: address
    sendExcessesTo: address?
}

type AllowedMessageToWallet =
    | AskToTransfer
    | AskToBurn
    | InternalTransferStep

type BounceOpToHandle = InternalTransferStep | BurnNotificationForMinter

fun onBouncedMessage(in: InMessageBounced) {
    in.bouncedBody.skipBouncedPrefix();

    val msg = lazy BounceOpToHandle.fromSlice(in.bouncedBody);
    val restoreAmount = match (msg) {
        InternalTransferStep => msg.jettonAmount,
        BurnNotificationForMinter => msg.jettonAmount,
    };

    var storage = lazy WalletStorage.load();
    storage.jettonBalance += restoreAmount;
    storage.save();
}

fun onInternalMessage(in: InMessage) {
    val msg = lazy AllowedMessageToWallet.fromSlice(in.body);

    match (msg) {
        InternalTransferStep => {
            var storage = lazy WalletStorage.load();
            if (in.senderAddress != storage.minterAddress) {
                assert (in.senderAddress == calcAddressOfJettonWallet(msg.transferInitiator!, storage.minterAddress, contract.getCode())) throw ERR_INVALID_WALLET;
            }
            storage.jettonBalance += msg.jettonAmount;
            storage.save();

            var msgValue = in.valueCoins;
            var tonBalanceBeforeMsg = contract.getOriginalBalance() - msgValue;
            var storageFee = MIN_TONS_FOR_STORAGE - min(tonBalanceBeforeMsg, MIN_TONS_FOR_STORAGE);
            msgValue -= (storageFee + JETTON_WALLET_GAS_CONSUMPTION);

            if (msg.forwardTonAmount != 0) {
                msgValue -= (msg.forwardTonAmount + in.originalForwardFee);

                val notifyOwnerMsg = createMessage({
                    bounce: BounceMode.NoBounce,
                    dest: storage.ownerAddress,
                    value: msg.forwardTonAmount,
                    body: TransferNotificationForRecipient {
                        queryId: msg.queryId,
                        jettonAmount: msg.jettonAmount,
                        transferInitiator: msg.transferInitiator,
                        forwardPayload: msg.forwardPayload
                    }
                });
                notifyOwnerMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
            }

            if (msg.sendExcessesTo != null & (msgValue > 0)) {
                val excessesMsg = createMessage({
                    bounce: BounceMode.NoBounce,
                    dest: msg.sendExcessesTo!,
                    value: msgValue,
                    body: ReturnExcessesBack {
                        queryId: msg.queryId
                    }
                });
                excessesMsg.send(SEND_MODE_IGNORE_ERRORS);
            }
        }

        AskToTransfer => {
            // standard checks
            assert (msg.transferRecipient.getWorkchain() == BASECHAIN) throw ERR_WRONG_WORKCHAIN;

            var storage = lazy WalletStorage.load();
            assert (in.senderAddress == storage.ownerAddress) throw ERR_NOT_FROM_OWNER;
            assert (storage.jettonBalance >= msg.jettonAmount) throw ERR_NOT_ENOUGH_BALANCE;
            storage.jettonBalance -= msg.jettonAmount;
            storage.save();

            var forwardedMessagesCount = msg.forwardTonAmount != 0 ? 2 : 1;
            assert (in.valueCoins >
                msg.forwardTonAmount +
                forwardedMessagesCount * in.originalForwardFee +
                (2 * JETTON_WALLET_GAS_CONSUMPTION + MIN_TONS_FOR_STORAGE)
            ) throw ERR_NOT_ENOUGH_TON;

            val deployMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: calcDeployedJettonWallet(msg.transferRecipient, storage.minterAddress, contract.getCode()),
                value: 0,
                body: InternalTransferStep {
                    queryId: msg.queryId,
                    jettonAmount: msg.jettonAmount,
                    transferInitiator: storage.ownerAddress,
                    sendExcessesTo: msg.sendExcessesTo,
                    forwardTonAmount: msg.forwardTonAmount,
                    forwardPayload: msg.forwardPayload,
                }
            });
            deployMsg.send(SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE);
        }

        AskToBurn => {
            var storage = lazy WalletStorage.load();
            assert (in.senderAddress == storage.ownerAddress) throw ERR_NOT_FROM_OWNER;
            assert (storage.jettonBalance >= msg.jettonAmount) throw ERR_NOT_ENOUGH_BALANCE;
            storage.jettonBalance -= msg.jettonAmount;
            storage.save();

            val notifyMinterMsg = createMessage({
                bounce: BounceMode.Only256BitsOfBody,
                dest: storage.minterAddress,
                value: 0,
                body: BurnNotificationForMinter {
                    queryId: msg.queryId,
                    jettonAmount: msg.jettonAmount,
                    burnInitiator: storage.ownerAddress,
                    sendExcessesTo: msg.sendExcessesTo,
                }
            });
            notifyMinterMsg.send(SEND_MODE_CARRY_ALL_REMAINING_MESSAGE_VALUE | SEND_MODE_BOUNCE_ON_ACTION_FAIL);
        }

        else => {
            assert (in.body.isEmpty()) throw 0xFFFF
        }
    }
}

struct JettonWalletDataReply {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
    jettonWalletCode: cell
}

get fun get_wallet_data(): JettonWalletDataReply {
    val storage = lazy WalletStorage.load();

    return JettonWalletDataReply {
        jettonBalance: storage.jettonBalance,
        ownerAddress: storage.ownerAddress,
        minterAddress: storage.minterAddress,
        jettonWalletCode: contract.getCode()
    };
}

```

## Source: DIAO Vesting Controller

File: `contracts/contracts/diao_vesting_controller.tolk`

```tolk
import "@stdlib/gas-payments"
import "diao_config"
import "@stdlib/tvm-dicts"

// Error codes
const ERR_NOT_FROM_ADMIN = 101;
const ERR_NOT_FROM_PRICE_ADMIN = 102;
const ERR_SALE_NOT_ACTIVE = 103;
const ERR_SALE_FINALIZED = 104;
const ERR_USER_LIMIT_EXCEEDED = 105;
const ERR_TOTAL_LIMIT_EXCEEDED = 106;
const ERR_INSUFFICIENT_PAYMENT = 107;
const ERR_NOT_FUNDED = 108;
const ERR_PAUSED = 109;
const ERR_COOLDOWN_NOT_MET = 110;
const ERR_PRICE_EXPIRED = 111;
const ERR_ROUND_ALREADY_UNLOCKED = 112;
const ERR_INVALID_ROUND = 113;
const ERR_PRICE_TOO_LOW = 114;
const ERR_NOT_FROM_OFFICIAL_RESERVE = 115;
const ERR_NOT_FROM_TEAM = 116;
const ERR_NOTHING_TO_CLAIM = 117;
const ERR_SALE_NOT_FINALIZED = 118;
const ERR_NOT_ENOUGH_TON = 119;
const ERR_INVALID_ADMIN_ACTION = 120;
const ERR_PENDING_ROUND_EXISTS = 121;
const ERR_INVALID_RESCUE_RECIPIENT = 122;
const ERR_RESCUE_AMOUNT_EXCEEDED = 123;
const ERR_INVALID_PAYLOAD = 77;

// Structs
struct UserPackageInfo {
    packageCount: uint8
    highestClaimedRound: uint8
}

struct VestingControllerStorage {
    adminAddress: address
    priceSourceAddress: address
    treasuryAddress: address
    officialReserveAddress: address
    teamAddress: address
    emergencyRescueAddress: address
    jettonMinterAddress: address
    jettonWalletCode: cell
    saleActive: bool
    saleFinalized: bool
    paused: bool
    totalPackagesSold: int
    currentUnlockedRound: int
    pendingRound: int
    pendingSubmittedAt: int
    userPackages: map<address, UserPackageInfo>
    reserveAlreadyClaimed: coins
    teamClaimedRound: int
    funded: bool
    emergencyRescued: coins
}

fun loadVestingStorage(): VestingControllerStorage {
    var ds = contract.getData().beginParse();
    val adminAddress = ds.loadAddress();
    val priceSourceAddress = ds.loadAddress();
    val treasuryAddress = ds.loadAddress();
    
    var ds2 = ds.loadRef().beginParse();
    val officialReserveAddress = ds2.loadAddress();
    val teamAddress = ds2.loadAddress();
    val jettonMinterAddress = ds2.loadAddress();
    ds2.assertEnd();

    var ds4 = ds.loadRef().beginParse();
    val emergencyRescueAddress = ds4.loadAddress();
    ds4.assertEnd();
    
    var ds3 = ds.loadRef().beginParse();
    val jettonWalletCode = ds3.loadRef();
    val saleActive = ds3.loadBool();
    val saleFinalized = ds3.loadBool();
    val paused = ds3.loadBool();
    val totalPackagesSold = ds3.loadUint(16);
    val currentUnlockedRound = ds3.loadUint(8);
    val pendingRound = ds3.loadUint(8);
    val pendingSubmittedAt = ds3.loadUint(32);
    val userPackages = ds3.loadDict();
    val reserveAlreadyClaimed = ds3.loadCoins();
    val teamClaimedRound = ds3.loadUint(8);
    val funded = ds3.loadBool();
    val emergencyRescued = ds3.loadCoins();
    ds3.assertEnd();
    
    ds.assertEnd();
    
    val typedMap = createMapFromLowLevelDict<address, UserPackageInfo>(userPackages);

    return VestingControllerStorage {
        adminAddress,
        priceSourceAddress,
        treasuryAddress,
        officialReserveAddress,
        teamAddress,
        emergencyRescueAddress,
        jettonMinterAddress,
        jettonWalletCode,
        saleActive,
        saleFinalized,
        paused,
        totalPackagesSold,
        currentUnlockedRound,
        pendingRound,
        pendingSubmittedAt,
        userPackages: typedMap,
        reserveAlreadyClaimed,
        teamClaimedRound,
        funded,
        emergencyRescued
    };
}

fun saveVestingStorage(s: VestingControllerStorage) {
    val rawDict = s.userPackages.toLowLevelDict();
    
    val cell2 = beginCell()
        .storeAddress(s.officialReserveAddress)
        .storeAddress(s.teamAddress)
        .storeAddress(s.jettonMinterAddress)
        .endCell();

    val cell4 = beginCell()
        .storeAddress(s.emergencyRescueAddress)
        .endCell();
        
    val cell3 = beginCell()
        .storeRef(s.jettonWalletCode)
        .storeBool(s.saleActive)
        .storeBool(s.saleFinalized)
        .storeBool(s.paused)
        .storeUint(s.totalPackagesSold, 16)
        .storeUint(s.currentUnlockedRound, 8)
        .storeUint(s.pendingRound, 8)
        .storeUint(s.pendingSubmittedAt, 32)
        .storeDict(rawDict)
        .storeCoins(s.reserveAlreadyClaimed)
        .storeUint(s.teamClaimedRound, 8)
        .storeBool(s.funded)
        .storeCoins(s.emergencyRescued)
        .endCell();

    var builder = beginCell()
        .storeAddress(s.adminAddress)
        .storeAddress(s.priceSourceAddress)
        .storeAddress(s.treasuryAddress)
        .storeRef(cell2)
        .storeRef(cell4)
        .storeRef(cell3);
        
    contract.setData(builder.endCell());
}

struct WalletStorageRef {
    jettonBalance: coins
    ownerAddress: address
    minterAddress: address
}

fun calcDeployedJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell): AutoDeployAddress {
    val emptyWalletStorage = WalletStorageRef {
        jettonBalance: 0,
        ownerAddress,
        minterAddress
    };

    return {
        stateInit: {
            code: jettonWalletCode,
            data: emptyWalletStorage.toCell()
        }
    };
}

fun calcAddressOfJettonWallet(ownerAddress: address, minterAddress: address, jettonWalletCode: cell) {
    val jwDeployed = calcDeployedJettonWallet(ownerAddress, minterAddress, jettonWalletCode);
    return jwDeployed.calculateAddress()
}

// Opcodes & Messages
struct (0x42555950) BuyPackage {
    queryId: uint64
    packageCount: uint8
}

struct (0x434c6275) ClaimBuyer {
    queryId: uint64
}

struct (0x434c7265) ClaimReserve {
    queryId: uint64
}

struct (0x434c746d) ClaimTeam {
    queryId: uint64
}

struct (0x53554250) SubmitPrice {
    queryId: uint64
    price: uint64
    targetRound: uint8
}

struct (0x4558554e) ExecuteUnlock {
    queryId: uint64
}

struct (0x5744544f) WithdrawTon {
    queryId: uint64
    amount: coins
}

struct (0x41444d43) AdminControl {
    queryId: uint64
    action: uint8
    payload: RemainingBitsAndRefs
}

struct (0x45525351) EmergencyRescueDiao {
    queryId: uint64
    recipient: address
    amount: coins
}

// Jetton Messages
struct (0x0f8a7ea5) AskToTransfer {
    queryId: uint64
    jettonAmount: coins
    transferRecipient: address
    sendExcessesTo: address?
    customPayload: cell?
    forwardTonAmount: coins
    forwardPayload: RemainingBitsAndRefs
}

struct (0x7362d09c) TransferNotificationForRecipient {
    queryId: uint64
    jettonAmount: coins
    transferInitiator: address?
    forwardPayload: RemainingBitsAndRefs
}

struct (0xd53276db) ReturnExcessesBack {
    queryId: uint64
}

type AllowedMessageToVesting =
    | BuyPackage
    | ClaimBuyer
    | ClaimReserve
    | ClaimTeam
    | SubmitPrice
    | ExecuteUnlock
    | WithdrawTon
    | AdminControl
    | EmergencyRescueDiao
    | ReturnExcessesBack

fun sendJettonTransfer(
    jettonWalletAddress: address,
    queryId: int,
    jettonAmount: int,
    recipient: address,
    sendExcessesTo: address,
    tonAmount: int
) {
    val emptyPayload = beginCell().endCell().beginParse();

    val transferMsg = AskToTransfer {
        queryId,
        jettonAmount,
        transferRecipient: recipient,
        sendExcessesTo,
        customPayload: null,
        forwardTonAmount: 0,
        forwardPayload: emptyPayload
    };

    val msg = createMessage({
        bounce: BounceMode.Only256BitsOfBody,
        dest: jettonWalletAddress,
        value: tonAmount,
        body: transferMsg.toCell()
    });
    msg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun onBouncedMessage(in: InMessageBounced) {
    in.bouncedBody.skipBouncedPrefix();
}

fun isSenderVestingWallet(senderAddress: address): bool {
    var ds = contract.getData().beginParse();
    ds.loadAddress(); // adminAddress
    ds.loadAddress(); // priceSourceAddress
    ds.loadAddress(); // treasuryAddress
    
    var ds2 = ds.loadRef().beginParse();
    ds2.loadAddress(); // officialReserveAddress
    ds2.loadAddress(); // teamAddress
    val jettonMinterAddress = ds2.loadAddress();

    var ds4 = ds.loadRef().beginParse();
    ds4.loadAddress(); // emergencyRescueAddress
    ds4.assertEnd();
    
    var ds3 = ds.loadRef().beginParse();
    val jettonWalletCode = ds3.loadRef();
    
    val expectedWallet = calcAddressOfJettonWallet(contract.getAddress(), jettonMinterAddress, jettonWalletCode);
    return senderAddress == expectedWallet;
}

fun onInternalMessage(in: InMessage) {
    var body = in.body;
    if (body.remainingBitsCount() < 32) {
        return; // ignore empty/deploy messages
    }

    val op = body.preloadUint(32);
    if (op == 0x7362d09c) {
        body.skipBits(32);
        val queryId = body.loadUint(64);
        val jettonAmount = body.loadCoins();
        if (isSenderVestingWallet(in.senderAddress)) {
            if (jettonAmount == LOCKED_SUPPLY) {
                var storage = loadVestingStorage();
                storage.funded = true;
                saveVestingStorage(storage);
            }
        }
        return;
    }
    if (op == 0xd53276db) { // ReturnExcessesBack
        return;
    }

    handleAllowedMessage(in.senderAddress, in.valueCoins, in.body);
}

fun handleAllowedMessage(senderAddress: address, valueCoins: coins, body: slice) {
    val msg = lazy AllowedMessageToVesting.fromSlice(body);

    match (msg) {
        BuyPackage => {
            var storage = loadVestingStorage();
            assert(storage.funded) throw ERR_NOT_FUNDED;
            assert(storage.saleActive) throw ERR_SALE_NOT_ACTIVE;
            assert(!storage.saleFinalized) throw ERR_SALE_FINALIZED;
            assert(!storage.paused) throw ERR_PAUSED;

            val packageCount = msg.packageCount;
            assert((packageCount >= 1) & (packageCount <= 10)) throw ERR_INVALID_PAYLOAD;

            val userAddress = senderAddress;
            var currentPackages = 0;
            var highestClaimed = 0;

            var r = storage.userPackages.get(userAddress);
            if (r.isFound) {
                val info = r.loadValue();
                currentPackages = info.packageCount;
                highestClaimed = info.highestClaimedRound;
            }

            assert(currentPackages + packageCount <= MAX_PACKAGES_PER_WALLET) throw ERR_USER_LIMIT_EXCEEDED;
            assert(storage.totalPackagesSold + packageCount <= MAX_PACKAGES_TOTAL) throw ERR_TOTAL_LIMIT_EXCEEDED;

            // Verify TON payment: packageCount * 58 TON + 0.1 TON (gas for transfer)
            val requiredPayment = packageCount * PACKAGE_PRICE_TON + ton("0.1");
            assert(valueCoins >= requiredPayment) throw ERR_INSUFFICIENT_PAYMENT;

            // Update storage
            storage.userPackages.set(userAddress, UserPackageInfo {
                packageCount: currentPackages + packageCount,
                highestClaimedRound: highestClaimed
            });
            storage.totalPackagesSold += packageCount;

            // Check auto-finalize
            if (storage.totalPackagesSold == MAX_PACKAGES_TOTAL) {
                storage.saleFinalized = true;
                storage.saleActive = false;
            }

            saveVestingStorage(storage);

            // Immediate reward: packageCount * 200,000 DIAO
            val immediateAmount = packageCount * PACKAGE_IMMEDIATE;
            
            // Jetton Wallet address of this contract
            val jettonWallet = calcAddressOfJettonWallet(contract.getAddress(), storage.jettonMinterAddress, storage.jettonWalletCode);
            
            // Excesses go to the buyer
            val tonToSend = valueCoins - (packageCount * PACKAGE_PRICE_TON);

            sendJettonTransfer(
                jettonWallet,
                msg.queryId,
                immediateAmount,
                userAddress,
                userAddress,
                tonToSend
            );
        }

        ClaimBuyer => {
            var storage = loadVestingStorage();
            assert(storage.funded) throw ERR_NOT_FUNDED;
            assert(!storage.paused) throw ERR_PAUSED;

            val userAddress = senderAddress;
            var r = storage.userPackages.get(userAddress);
            assert(r.isFound) throw ERR_NOTHING_TO_CLAIM;

            val info = r.loadValue();
            val packageCount = info.packageCount;
            val highestClaimed = info.highestClaimedRound;

            val currentUnlocked = storage.currentUnlockedRound;
            val maxClaimableRound = min(currentUnlocked, MAX_BUYER_ROUNDS); // max round 15

            assert(maxClaimableRound > highestClaimed) throw ERR_NOTHING_TO_CLAIM;

            val claimableRounds = maxClaimableRound - highestClaimed;
            val claimAmount = claimableRounds * packageCount * BUYER_RELEASE_PER_ROUND;

            // Update user info
            storage.userPackages.set(userAddress, UserPackageInfo {
                packageCount: packageCount,
                highestClaimedRound: maxClaimableRound
            });
            saveVestingStorage(storage);

            // Send transfer
            val jettonWallet = calcAddressOfJettonWallet(contract.getAddress(), storage.jettonMinterAddress, storage.jettonWalletCode);
            
            val tonToSend = valueCoins - ton("0.05");
            assert(tonToSend > ton("0.05")) throw ERR_NOT_ENOUGH_TON;

            sendJettonTransfer(
                jettonWallet,
                msg.queryId,
                claimAmount,
                userAddress,
                userAddress,
                tonToSend
            );
        }

        ClaimReserve => {
            var storage = loadVestingStorage();
            assert(storage.funded) throw ERR_NOT_FUNDED;
            assert(storage.saleFinalized) throw ERR_SALE_NOT_FINALIZED;
            assert(!storage.paused) throw ERR_PAUSED;
            assert(senderAddress == storage.officialReserveAddress) throw ERR_NOT_FROM_OFFICIAL_RESERVE;

            val currentUnlocked = storage.currentUnlockedRound;
            val n = min(currentUnlocked, MAX_BUYER_ROUNDS); // rounds 1-15 only

            // official_reserve_total = 7.5B - total_packages_sold * 3.2M
            // Only from buyer+reserve pool (7.5B), NOT from team pool (1.5B)
            val soldAmount = storage.totalPackagesSold * PACKAGE_TOTAL;
            assert(soldAmount <= BUYER_AND_RESERVE_POOL) throw ERR_INVALID_PAYLOAD;
            val totalReservePool = BUYER_AND_RESERVE_POOL - soldAmount;
            
            // reserve_claimable_after_round_n = floor(official_reserve_total * n / 15)
            val totalClaimable = (totalReservePool * n) / MAX_BUYER_ROUNDS;
            val claimAmount = totalClaimable - storage.reserveAlreadyClaimed;

            assert(claimAmount > 0) throw ERR_NOTHING_TO_CLAIM;

            // Update storage
            storage.reserveAlreadyClaimed += claimAmount;
            saveVestingStorage(storage);

            // Send transfer
            val jettonWallet = calcAddressOfJettonWallet(contract.getAddress(), storage.jettonMinterAddress, storage.jettonWalletCode);
            
            val tonToSend = valueCoins - ton("0.05");
            assert(tonToSend > ton("0.05")) throw ERR_NOT_ENOUGH_TON;

            sendJettonTransfer(
                jettonWallet,
                msg.queryId,
                claimAmount,
                storage.officialReserveAddress,
                storage.officialReserveAddress,
                tonToSend
            );
        }

        ClaimTeam => {
            var storage = loadVestingStorage();
            assert(storage.funded) throw ERR_NOT_FUNDED;
            assert(!storage.paused) throw ERR_PAUSED;
            assert(senderAddress == storage.teamAddress) throw ERR_NOT_FROM_TEAM;

            val currentUnlocked = storage.currentUnlockedRound;
            assert(currentUnlocked >= 16) throw ERR_NOTHING_TO_CLAIM;

            val maxClaimableRound = min(currentUnlocked, TOTAL_ROUNDS); // max round 18
            val lastClaimed = storage.teamClaimedRound; // initially 15

            assert(maxClaimableRound > lastClaimed) throw ERR_NOTHING_TO_CLAIM;

            val claimableRounds = maxClaimableRound - lastClaimed;
            val claimAmount = claimableRounds * ROUND_ALLOCATION; // 500M per round

            // Update storage
            storage.teamClaimedRound = maxClaimableRound;
            saveVestingStorage(storage);

            // Send transfer
            val jettonWallet = calcAddressOfJettonWallet(contract.getAddress(), storage.jettonMinterAddress, storage.jettonWalletCode);
            
            val tonToSend = valueCoins - ton("0.05");
            assert(tonToSend > ton("0.05")) throw ERR_NOT_ENOUGH_TON;

            sendJettonTransfer(
                jettonWallet,
                msg.queryId,
                claimAmount,
                storage.teamAddress,
                storage.teamAddress,
                tonToSend
            );
        }

        SubmitPrice => {
            var storage = loadVestingStorage();
            assert(senderAddress == storage.priceSourceAddress) throw ERR_NOT_FROM_PRICE_ADMIN;
            assert(!storage.paused) throw ERR_PAUSED;
            assert(storage.pendingRound == 0) throw ERR_PENDING_ROUND_EXISTS;

            val targetRound = msg.targetRound;
            assert(targetRound == storage.currentUnlockedRound + 1) throw ERR_INVALID_ROUND;
            assert(targetRound <= TOTAL_ROUNDS) throw ERR_INVALID_ROUND;

            val targetPrice = INITIAL_PRICE_SCALED * (1 << targetRound);
            assert(msg.price >= targetPrice) throw ERR_PRICE_TOO_LOW;

            // Set pending
            storage.pendingRound = targetRound;
            storage.pendingSubmittedAt = blockchain.now();
            saveVestingStorage(storage);
        }

        ExecuteUnlock => {
            var storage = loadVestingStorage();
            assert(!storage.paused) throw ERR_PAUSED;

            val targetRound = storage.pendingRound;
            assert(targetRound == storage.currentUnlockedRound + 1) throw ERR_INVALID_ROUND;
            assert(targetRound <= TOTAL_ROUNDS) throw ERR_INVALID_ROUND;

            val currentTime = blockchain.now();
            assert(currentTime >= storage.pendingSubmittedAt + MANUAL_PRICE_COOLDOWN) throw ERR_COOLDOWN_NOT_MET;
            assert(currentTime <= storage.pendingSubmittedAt + MANUAL_PRICE_VALIDITY) throw ERR_PRICE_EXPIRED;

            // Execute unlock
            storage.currentUnlockedRound = targetRound;
            storage.pendingRound = 0;
            storage.pendingSubmittedAt = 0;
            saveVestingStorage(storage);
        }

        WithdrawTon => {
            var storage = loadVestingStorage();
            assert(senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;

            val amount = msg.amount;
            val balance = contract.getOriginalBalance();
            
            assert(amount + MIN_CONTROLLER_TON_RESERVE <= balance) throw ERR_NOT_ENOUGH_TON;

            val withdrawMsg = createMessage({
                bounce: BounceMode.NoBounce,
                dest: storage.treasuryAddress,
                value: amount,
                body: ReturnExcessesBack {
                    queryId: msg.queryId
                }
            });
            withdrawMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
        }

        AdminControl => {
            var storage = loadVestingStorage();
            assert (senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;
            
            val action = msg.action;
            var ps = msg.payload as slice;
            
            if (action == 1) { // close sale
                assert(!storage.saleFinalized) throw ERR_SALE_FINALIZED;
                storage.saleActive = false;
            } else if (action == 2) { // open sale
                assert(!storage.saleFinalized) throw ERR_SALE_FINALIZED;
                storage.saleActive = true;
            } else if (action == 3) { // pause
                storage.paused = true;
            } else if (action == 4) { // unpause
                storage.paused = false;
            } else if (action == 5) { // update price admin
                assert(ps.remainingBitsCount() >= 267) throw ERR_INVALID_PAYLOAD;
                val newPriceAdmin = ps.loadAddress();
                storage.priceSourceAddress = newPriceAdmin;
            } else if (action == 7) { // finalize sale
                storage.saleFinalized = true;
                storage.saleActive = false;
            } else {
                assert(false) throw ERR_INVALID_ADMIN_ACTION;
            }
            saveVestingStorage(storage);
        }

        EmergencyRescueDiao => {
            var storage = loadVestingStorage();
            assert(senderAddress == storage.adminAddress) throw ERR_NOT_FROM_ADMIN;
            assert(storage.funded) throw ERR_NOT_FUNDED;
            assert(storage.paused) throw ERR_PAUSED;
            assert(msg.recipient == storage.emergencyRescueAddress) throw ERR_INVALID_RESCUE_RECIPIENT;

            val soldAmount = storage.totalPackagesSold * PACKAGE_TOTAL;
            assert(soldAmount <= BUYER_AND_RESERVE_POOL) throw ERR_INVALID_PAYLOAD;
            val reserveRemaining = BUYER_AND_RESERVE_POOL - soldAmount - storage.reserveAlreadyClaimed;
            val claimedTeamRounds = storage.teamClaimedRound - MAX_BUYER_ROUNDS;
            val teamClaimedAmount = claimedTeamRounds * ROUND_ALLOCATION;
            val teamRemaining = TEAM_TOTAL - teamClaimedAmount;
            val rescueable = reserveRemaining + teamRemaining - storage.emergencyRescued;

            assert(msg.amount > 0) throw ERR_NOTHING_TO_CLAIM;
            assert(msg.amount <= rescueable) throw ERR_RESCUE_AMOUNT_EXCEEDED;

            storage.emergencyRescued += msg.amount;
            saveVestingStorage(storage);

            val jettonWallet = calcAddressOfJettonWallet(contract.getAddress(), storage.jettonMinterAddress, storage.jettonWalletCode);
            val tonToSend = valueCoins - ton("0.05");
            assert(tonToSend > ton("0.05")) throw ERR_NOT_ENOUGH_TON;

            sendJettonTransfer(
                jettonWallet,
                msg.queryId,
                msg.amount,
                msg.recipient,
                msg.recipient,
                tonToSend
            );
        }

        ReturnExcessesBack => {
            // Ignore excesses
        }
    }
}

struct VestingDataReply {
    adminAddress: address
    priceSourceAddress: address
    treasuryAddress: address
    officialReserveAddress: address
    teamAddress: address
    emergencyRescueAddress: address
    jettonMinterAddress: address
    saleActive: bool
    saleFinalized: bool
    paused: bool
    totalPackagesSold: int
    currentUnlockedRound: int
    pendingRound: int
    pendingSubmittedAt: int
    reserveAlreadyClaimed: coins
    teamClaimedRound: int
    funded: bool
    emergencyRescued: coins
}

get fun get_vesting_data(): VestingDataReply {
    val storage = loadVestingStorage();

    return VestingDataReply {
        adminAddress: storage.adminAddress,
        priceSourceAddress: storage.priceSourceAddress,
        treasuryAddress: storage.treasuryAddress,
        officialReserveAddress: storage.officialReserveAddress,
        teamAddress: storage.teamAddress,
        emergencyRescueAddress: storage.emergencyRescueAddress,
        jettonMinterAddress: storage.jettonMinterAddress,
        saleActive: storage.saleActive,
        saleFinalized: storage.saleFinalized,
        paused: storage.paused,
        totalPackagesSold: storage.totalPackagesSold,
        currentUnlockedRound: storage.currentUnlockedRound,
        pendingRound: storage.pendingRound,
        pendingSubmittedAt: storage.pendingSubmittedAt,
        reserveAlreadyClaimed: storage.reserveAlreadyClaimed,
        teamClaimedRound: storage.teamClaimedRound,
        funded: storage.funded,
        emergencyRescued: storage.emergencyRescued
    };
}

get fun get_user_packages(userAddress: address): UserPackageInfo {
    var storage = loadVestingStorage();
    var r = storage.userPackages.get(userAddress);
    if (r.isFound) {
        return r.loadValue();
    }
    return UserPackageInfo { packageCount: 0, highestClaimedRound: 0 };
}

get fun get_vesting_wallet_address(): address {
    var storage = loadVestingStorage();
    return calcAddressOfJettonWallet(contract.getAddress(), storage.jettonMinterAddress, storage.jettonWalletCode);
}

```

## Source: Mainnet/Testnet Config

File: `contracts/wrappers/config.ts`

```ts
import { Address } from '@ton/core';

export const config = {
    initialCirculationWallet: Address.parse('UQBv9pBWH7R_gv2mGYXKwGX59S6RH7wuramDTRyb8OUqoycQ'),
    officialReserveWallet: Address.parse('UQDo48rWrpPU9ouJk5ZoKzTFPHUfqt1tZEKvtFE73xcyGZFA'),
    teamWallet: Address.parse('UQAXy5kyjrLT2mgIOB_AbhalM4R-ZL_bM2QjyY6hTS1FfktJ'),
    emergencyRescueWallet: Address.parse('UQDcCX8Vfq5TaR1ZgV7_Za0dsSy0ZxZvhUUYi77gWfHiBG4R'),
    adminWallet: Address.parse('UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD'),
    priceAdminWallet: Address.parse('UQAcqAC9jSjC4Ay77-cZZ__-vAMr9WvWmS3Vo2BwmzWUdITD'),
    treasuryWallet: Address.parse('UQDDSkodFARAsYCVSzE9MgMrYk44PF95UyZcYwLDFnkXskXp'),
};

```

## Source: DIAO Vesting Controller Wrapper

File: `contracts/wrappers/DIAOVestingController.ts`

```ts
import {
    Address,
    beginCell,
    Cell,
    Contract,
    ContractABI,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode
} from '@ton/core';

export type DIAOVestingControllerConfig = {
    adminAddress: Address;
    priceSourceAddress: Address;
    treasuryAddress: Address;
    officialReserveAddress: Address;
    teamAddress: Address;
    emergencyRescueAddress: Address;
    jettonMinterAddress: Address;
    jettonWalletCode: Cell;
    saleActive: boolean;
    saleFinalized: boolean;
    paused: boolean;
    totalPackagesSold: number;
    currentUnlockedRound: number;
    pendingRound: number;
    pendingSubmittedAt: number;
    reserveAlreadyClaimed: bigint;
    teamClaimedRound: number;
    funded: boolean;
    emergencyRescued: bigint;
};

export function diaoVestingControllerConfigToCell(config: DIAOVestingControllerConfig): Cell {
    const cell2 = beginCell()
        .storeAddress(config.officialReserveAddress)
        .storeAddress(config.teamAddress)
        .storeAddress(config.jettonMinterAddress)
        .endCell();

    const cell4 = beginCell()
        .storeAddress(config.emergencyRescueAddress)
        .endCell();

    const cell3 = beginCell()
        .storeRef(config.jettonWalletCode)
        .storeBit(config.saleActive)
        .storeBit(config.saleFinalized)
        .storeBit(config.paused)
        .storeUint(config.totalPackagesSold, 16)
        .storeUint(config.currentUnlockedRound, 8)
        .storeUint(config.pendingRound, 8)
        .storeUint(config.pendingSubmittedAt, 32)
        .storeBit(false) // userPackages is empty dict
        .storeCoins(config.reserveAlreadyClaimed)
        .storeUint(config.teamClaimedRound, 8)
        .storeBit(config.funded)
        .storeCoins(config.emergencyRescued)
        .endCell();

    return beginCell()
        .storeAddress(config.adminAddress)
        .storeAddress(config.priceSourceAddress)
        .storeAddress(config.treasuryAddress)
        .storeRef(cell2)
        .storeRef(cell4)
        .storeRef(cell3)
        .endCell();
}

export class DIAOVestingController implements Contract {
    abi: ContractABI = { name: 'DIAOVestingController' }

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new DIAOVestingController(address);
    }

    static createFromConfig(config: DIAOVestingControllerConfig, code: Cell, workchain = 0) {
        const data = diaoVestingControllerConfigToCell(config);
        const init = { code, data };
        return new DIAOVestingController(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendBuyPackage(
        provider: ContractProvider,
        via: Sender,
        opts: {
            packageCount: number;
            value: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x42555950, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeUint(opts.packageCount, 8)
                .endCell(),
        });
    }

    async sendClaimBuyer(provider: ContractProvider, via: Sender, opts: { value: bigint, queryId?: bigint }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x434c6275, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .endCell(),
        });
    }

    async sendClaimReserve(provider: ContractProvider, via: Sender, opts: { value: bigint, queryId?: bigint }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x434c7265, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .endCell(),
        });
    }

    async sendClaimTeam(provider: ContractProvider, via: Sender, opts: { value: bigint, queryId?: bigint }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x434c746d, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .endCell(),
        });
    }

    async sendSubmitPrice(
        provider: ContractProvider,
        via: Sender,
        opts: {
            price: bigint;
            targetRound: number;
            value: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x53554250, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeUint(opts.price, 64)
                .storeUint(opts.targetRound, 8)
                .endCell(),
        });
    }

    async sendExecuteUnlock(provider: ContractProvider, via: Sender, opts: { value: bigint, queryId?: bigint }) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x4558554e, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .endCell(),
        });
    }

    async sendWithdrawTon(
        provider: ContractProvider,
        via: Sender,
        opts: {
            amount: bigint;
            value: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x5744544f, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeCoins(opts.amount)
                .endCell(),
        });
    }

    async sendAdminControl(
        provider: ContractProvider,
        via: Sender,
        opts: {
            action: number;
            payload?: Cell;
            value: bigint;
            queryId?: bigint;
        }
    ) {
        const bodyBuilder = beginCell()
            .storeUint(0x41444d43, 32)
            .storeUint(opts.queryId ?? 0, 64)
            .storeUint(opts.action, 8);

        if (opts.payload) {
            bodyBuilder.storeSlice(opts.payload.beginParse());
        }

        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: bodyBuilder.endCell(),
        });
    }

    async sendEmergencyRescueDiao(
        provider: ContractProvider,
        via: Sender,
        opts: {
            recipient: Address;
            amount: bigint;
            value: bigint;
            queryId?: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x45525351, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeAddress(opts.recipient)
                .storeCoins(opts.amount)
                .endCell(),
        });
    }

    async getVestingData(provider: ContractProvider) {
        const res = await provider.get('get_vesting_data', []);
        const adminAddress = res.stack.readAddress();
        const priceSourceAddress = res.stack.readAddress();
        const treasuryAddress = res.stack.readAddress();
        const officialReserveAddress = res.stack.readAddress();
        const teamAddress = res.stack.readAddress();
        const emergencyRescueAddress = res.stack.readAddress();
        const jettonMinterAddress = res.stack.readAddress();
        const saleActive = res.stack.readBoolean();
        const saleFinalized = res.stack.readBoolean();
        const paused = res.stack.readBoolean();
        const totalPackagesSold = Number(res.stack.readBigNumber());
        const currentUnlockedRound = Number(res.stack.readBigNumber());
        const pendingRound = Number(res.stack.readBigNumber());
        const pendingSubmittedAt = Number(res.stack.readBigNumber());
        const reserveAlreadyClaimed = res.stack.readBigNumber();
        const teamClaimedRound = Number(res.stack.readBigNumber());
        const funded = res.stack.readBoolean();
        const emergencyRescued = res.stack.readBigNumber();

        return {
            adminAddress,
            priceSourceAddress,
            treasuryAddress,
            officialReserveAddress,
            teamAddress,
            emergencyRescueAddress,
            jettonMinterAddress,
            saleActive,
            saleFinalized,
            paused,
            totalPackagesSold,
            currentUnlockedRound,
            pendingRound,
            pendingSubmittedAt,
            reserveAlreadyClaimed,
            teamClaimedRound,
            funded,
            emergencyRescued,
        };
    }

    async getUserPackages(provider: ContractProvider, userAddress: Address) {
        const res = await provider.get('get_user_packages', [
            { type: 'slice', cell: beginCell().storeAddress(userAddress).endCell() }
        ]);
        const packageCount = Number(res.stack.readBigNumber());
        const highestClaimedRound = Number(res.stack.readBigNumber());
        return { packageCount, highestClaimedRound };
    }

    async getVestingWalletAddress(provider: ContractProvider): Promise<Address> {
        const res = await provider.get('get_vesting_wallet_address', []);
        return res.stack.readAddress();
    }
}

```

## Source: DIAO Jetton Minter Wrapper

File: `contracts/wrappers/DIAOJettonMinter.ts`

```ts
import {
    Address,
    beginCell,
    Cell,
    Contract,
    ContractABI,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode
} from '@ton/core';

export type DIAOJettonMinterConfig = {
    totalSupply: bigint;
    adminAddress: Address;
    content: Cell;
    jettonWalletCode: Cell;
    mintable: boolean;
};

export function diaoJettonMinterConfigToCell(config: DIAOJettonMinterConfig): Cell {
    return beginCell()
        .storeCoins(config.totalSupply)
        .storeAddress(config.adminAddress)
        .storeRef(config.content)
        .storeRef(config.jettonWalletCode)
        .storeBit(config.mintable)
        .endCell();
}

export class DIAOJettonMinter implements Contract {
    abi: ContractABI = { name: 'DIAOJettonMinter' }

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new DIAOJettonMinter(address);
    }

    static createFromConfig(config: DIAOJettonMinterConfig, code: Cell, workchain = 0) {
        const data = diaoJettonMinterConfigToCell(config);
        const init = { code, data };
        return new DIAOJettonMinter(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendInitMint(
        provider: ContractProvider,
        via: Sender,
        opts: {
            queryId?: bigint;
            initialCirculationAddress: Address;
            vestingControllerAddress: Address;
            initialCirculationTonAmount: bigint;
            vestingControllerTonAmount: bigint;
            value: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x5f616c6c, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeAddress(opts.initialCirculationAddress)
                .storeAddress(opts.vestingControllerAddress)
                .storeCoins(opts.initialCirculationTonAmount)
                .storeCoins(opts.vestingControllerTonAmount)
                .endCell(),
        });
    }

    async sendChangeAdmin(
        provider: ContractProvider,
        via: Sender,
        opts: {
            queryId?: bigint;
            newAdminAddress: Address;
            value: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x00000003, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeAddress(opts.newAdminAddress)
                .endCell(),
        });
    }

    async sendChangeContent(
        provider: ContractProvider,
        via: Sender,
        opts: {
            queryId?: bigint;
            newContent: Cell;
            value: bigint;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x00000004, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeRef(opts.newContent)
                .endCell(),
        });
    }

    async getJettonData(provider: ContractProvider) {
        const res = await provider.get('get_jetton_data', []);
        const totalSupply = res.stack.readBigNumber();
        const mintable = res.stack.readBoolean();
        const adminAddress = res.stack.readAddress();
        const content = res.stack.readCell();
        const walletCode = res.stack.readCell();
        return { totalSupply, mintable, adminAddress, content, walletCode };
    }

    async getWalletAddress(provider: ContractProvider, ownerAddress: Address): Promise<Address> {
        const res = await provider.get('get_wallet_address', [
            { type: 'slice', cell: beginCell().storeAddress(ownerAddress).endCell() }
        ]);
        return res.stack.readAddress();
    }
}

```

## Source: DIAO Jetton Wallet Wrapper

File: `contracts/wrappers/DIAOJettonWallet.ts`

```ts
import {
    Address,
    beginCell,
    Cell,
    Contract,
    ContractABI,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode
} from '@ton/core';

export type DIAOJettonWalletConfig = {
    jettonBalance: bigint;
    ownerAddress: Address;
    minterAddress: Address;
};

export function diaoJettonWalletConfigToCell(config: DIAOJettonWalletConfig): Cell {
    return beginCell()
        .storeCoins(config.jettonBalance)
        .storeAddress(config.ownerAddress)
        .storeAddress(config.minterAddress)
        .endCell();
}

export class DIAOJettonWallet implements Contract {
    abi: ContractABI = { name: 'DIAOJettonWallet' }

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new DIAOJettonWallet(address);
    }

    static createFromConfig(config: DIAOJettonWalletConfig, code: Cell, workchain = 0) {
        const data = diaoJettonWalletConfigToCell(config);
        const init = { code, data };
        return new DIAOJettonWallet(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendTransfer(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId?: bigint;
            jettonAmount: bigint;
            toAddress: Address;
            responseAddress: Address;
            forwardTonAmount: bigint;
            forwardPayload?: Cell;
        }
    ) {
        const forwardPayloadBuilder = beginCell();
        if (opts.forwardPayload) {
            forwardPayloadBuilder.storeRef(opts.forwardPayload);
        }

        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x0f8a7ea5, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeCoins(opts.jettonAmount)
                .storeAddress(opts.toAddress)
                .storeAddress(opts.responseAddress)
                .storeBit(false) // custom payload is null (represented by 1 bit = 0)
                .storeCoins(opts.forwardTonAmount)
                .storeBit(opts.forwardPayload ? true : false) // forward payload indicator (1 bit)
                .storeBuilder(forwardPayloadBuilder)
                .endCell(),
        });
    }

    async sendBurn(
        provider: ContractProvider,
        via: Sender,
        opts: {
            value: bigint;
            queryId?: bigint;
            jettonAmount: bigint;
            responseAddress: Address;
        }
    ) {
        await provider.internal(via, {
            value: opts.value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(0x595f07bc, 32)
                .storeUint(opts.queryId ?? 0, 64)
                .storeCoins(opts.jettonAmount)
                .storeAddress(opts.responseAddress)
                .storeBit(false) // custom payload is null (1 bit = 0)
                .endCell(),
        });
    }

    async getWalletData(provider: ContractProvider) {
        const res = await provider.get('get_wallet_data', []);
        const jettonBalance = res.stack.readBigNumber();
        const ownerAddress = res.stack.readAddress();
        const minterAddress = res.stack.readAddress();
        const jettonWalletCode = res.stack.readCell();
        return { jettonBalance, ownerAddress, minterAddress, jettonWalletCode };
    }
}

```

## Source: Deployment Script

File: `contracts/scripts/deployDIAOJettonMinter.ts`

```ts
import { toNano, beginCell, Address } from '@ton/core';
import 'dotenv/config';
import { DIAOJettonMinter } from '../wrappers/DIAOJettonMinter';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';
import { config as addrConfig } from '../wrappers/config';
import { compile, NetworkProvider } from '@ton/blueprint';
import { appendFileSync } from 'fs';

const metadataUrl = process.env.DIAO_METADATA_URL
    ?? 'https://ivory-keen-perch-796.mypinata.cloud/ipfs/bafkreigsnrrxhqvxhst2xay7pythep5auoprv3ekuzruyp77jwtqjgp4im';

/**
 * DIAO Full Deployment Script
 *
 * Deployment order:
 * 1. Deploy Jetton Minter
 * 2. Deploy Vesting Controller (needs minter address)
 * 3. Call init_mint on Minter (sends 1B DIAO to circulation wallet + 9B DIAO to vesting)
 *
 * After init_mint:
 * - Minter is locked (no more minting)
 * - Vesting Controller is funded (funded = true)
 * - Sale is open by default; admin can close it if needed
 */
export async function run(provider: NetworkProvider) {
    const isTestnet = provider.network() === 'testnet';
    const testnetWallet = isTestnet && process.env.DIAO_TESTNET_WALLET
        ? Address.parse(process.env.DIAO_TESTNET_WALLET)
        : null;
    const deployConfig = testnetWallet
        ? {
            initialCirculationWallet: testnetWallet,
            officialReserveWallet: testnetWallet,
            teamWallet: testnetWallet,
            emergencyRescueWallet: testnetWallet,
            adminWallet: testnetWallet,
            priceAdminWallet: testnetWallet,
            treasuryWallet: testnetWallet,
        }
        : addrConfig;
    const metadataSalt = isTestnet ? process.env.DIAO_TESTNET_DEPLOY_SALT : undefined;
    const deploymentMetadataUrl = metadataSalt ? `${metadataUrl}?deploy=${encodeURIComponent(metadataSalt)}` : metadataUrl;

    const sender = provider.sender();
    const senderAddress = sender.address;
    if (!senderAddress) {
        throw new Error('Sender address is not available. Make sure you are connected with a wallet.');
    }

    // ── Step 0: Compile contracts ──────────────────────────────────────
    console.log('⏳ Compiling contracts...');
    const minterCode = await compile('DIAOJettonMinter');
    const walletCode = await compile('DIAOJettonWallet');
    const vestingCode = await compile('DIAOVestingController');
    console.log('✅ Compilation complete.');

    // ── Step 1: Deploy Jetton Minter ───────────────────────────────────
    console.log('\n📦 Step 1: Deploying Jetton Minter...');

    // Jetton metadata (0x01 prefix = off-chain content URI)
    const contentCell = beginCell()
        .storeUint(0x01, 8) // off-chain metadata marker
        .storeStringTail(deploymentMetadataUrl)
        .endCell();

    const minter = provider.open(
        DIAOJettonMinter.createFromConfig(
            {
                totalSupply: 0n,
                adminAddress: senderAddress, // deployer is initial admin for init_mint
                content: contentCell,
                jettonWalletCode: walletCode,
                mintable: true,
            },
            minterCode
        )
    );

    await minter.sendDeploy(sender, toNano('0.05'));
    await provider.waitForDeploy(minter.address);
    console.log(`✅ Jetton Minter deployed at: ${minter.address}`);

    // ── Step 2: Deploy Vesting Controller ──────────────────────────────
    console.log('\n📦 Step 2: Deploying Vesting Controller...');

    const vesting = provider.open(
        DIAOVestingController.createFromConfig(
            {
                adminAddress: deployConfig.adminWallet,
                priceSourceAddress: deployConfig.priceAdminWallet,
                treasuryAddress: deployConfig.treasuryWallet,
                officialReserveAddress: deployConfig.officialReserveWallet,
                teamAddress: deployConfig.teamWallet,
                emergencyRescueAddress: deployConfig.emergencyRescueWallet,
                jettonMinterAddress: minter.address,
                jettonWalletCode: walletCode,
                saleActive: true,        // sale starts open per frozen requirement
                saleFinalized: false,
                paused: false,
                totalPackagesSold: 0,
                currentUnlockedRound: 0,
                pendingRound: 0,
                pendingSubmittedAt: 0,
                reserveAlreadyClaimed: 0n,
                teamClaimedRound: 15,    // team can claim starting round 16
                funded: false,           // will be set to true after init_mint
                emergencyRescued: 0n,
            },
            vestingCode
        )
    );

    await vesting.sendDeploy(sender, toNano('0.05'));
    await provider.waitForDeploy(vesting.address);
    console.log(`✅ Vesting Controller deployed at: ${vesting.address}`);

    // ── Step 3: Call init_mint ─────────────────────────────────────────
    console.log('\n🔒 Step 3: Calling init_mint (1B → circulation, 9B → vesting)...');
    console.log(`   Circulation wallet: ${deployConfig.initialCirculationWallet}`);
    console.log(`   Vesting controller: ${vesting.address}`);

    await minter.sendInitMint(sender, {
        initialCirculationAddress: deployConfig.initialCirculationWallet,
        vestingControllerAddress: vesting.address,
        initialCirculationTonAmount: toNano('0.15'),
        vestingControllerTonAmount: toNano('0.35'),
        value: toNano('0.8'),
    });

    console.log('✅ init_mint sent. Minter is now locked.');

    // ── Step 4: Transfer minter admin to multisig / DAO ───────────────
    console.log('\n🔑 Step 4: Transferring Minter admin to operational admin...');
    await minter.sendChangeAdmin(sender, {
        newAdminAddress: deployConfig.adminWallet,
        value: toNano('0.05'),
    });
    console.log(`✅ Minter admin transferred to: ${deployConfig.adminWallet}`);

    // ── Summary ───────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 DIAO DEPLOYMENT COMPLETE');
    console.log('═'.repeat(60));
    console.log(`  Jetton Minter:       ${minter.address}`);
    console.log(`  Vesting Controller:  ${vesting.address}`);
    console.log(`  Admin Wallet:        ${deployConfig.adminWallet}`);
    console.log(`  Treasury Wallet:     ${deployConfig.treasuryWallet}`);
    console.log(`  Price Admin:         ${deployConfig.priceAdminWallet}`);
    if (isTestnet) {
        appendFileSync(
            '.env',
            `\nDIAO_TESTNET_MINTER=${minter.address.toString()}\nDIAO_TESTNET_VESTING=${vesting.address.toString()}\n`,
        );
        console.log('  Saved testnet addresses to .env');
    }
    console.log('');
    console.log('Next steps:');
    console.log('  1. Verify init_mint completed (check vesting funded=true)');
    console.log('  2. Sale is open by default; admin can close if needed');
    console.log('  3. Price admin begins submitting prices for unlocks');
    console.log('═'.repeat(60));
}

```

## Source: Mainnet Status Script

File: `contracts/scripts/statusMainnetDIAO.ts`

```ts
import 'dotenv/config';
import { Address, toNano } from '@ton/core';
import { TonClient } from '@ton/ton';
import { DIAOJettonMinter } from '../wrappers/DIAOJettonMinter';
import { DIAOJettonWallet } from '../wrappers/DIAOJettonWallet';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';

const endpoint = process.env.TONCENTER_MAINNET_ENDPOINT ?? 'https://toncenter.com/api/v2/jsonRPC';
const apiKey = process.env.TONCENTER_API_KEY;
const minterAddress = process.env.DIAO_MAINNET_MINTER ?? 'EQDO5Wl-jFR2A9UrgZZKqQbV_2Ab56HZqMbVbj3G2noXJq3Y';
const vestingAddress = process.env.DIAO_MAINNET_VESTING ?? 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatUnits(amount: bigint) {
    const whole = amount / 1_000_000_000n;
    const fractional = amount % 1_000_000_000n;
    if (fractional === 0n) {
        return whole.toString();
    }
    return `${whole}.${fractional.toString().padStart(9, '0').replace(/0+$/, '')}`;
}

function isRateLimitError(error: unknown) {
    const candidate = error as { code?: string; response?: { status?: number }; status?: number };
    return candidate.response?.status === 429 || candidate.status === 429 || candidate.code === 'ECONNABORTED';
}

async function withRetry<T>(label: string, action: () => Promise<T>): Promise<T> {
    const delays = [0, 3_000, 8_000, 15_000, 30_000];
    for (let attempt = 0; attempt < delays.length; attempt += 1) {
        if (delays[attempt] > 0) {
            console.log(`${label}: waiting ${delays[attempt] / 1000}s before retry ${attempt}`);
            await sleep(delays[attempt]);
        }
        try {
            return await action();
        } catch (error) {
            if (!isRateLimitError(error) || attempt === delays.length - 1) {
                throw error;
            }
            console.warn(`${label}: RPC rate limit, retrying...`);
        }
    }
    throw new Error(`${label}: retry loop exhausted`);
}

async function main() {
    const client = new TonClient({ endpoint, apiKey });
    const minterAddressParsed = Address.parse(minterAddress);
    const vestingAddressParsed = Address.parse(vestingAddress);
    const minter = client.open(DIAOJettonMinter.createFromAddress(minterAddressParsed));
    const vesting = client.open(DIAOVestingController.createFromAddress(vestingAddressParsed));

    const minterData = await withRetry('get jetton data', () => minter.getJettonData());
    await sleep(1_500);
    const vestingData = await withRetry('get vesting data', () => vesting.getVestingData());
    await sleep(1_500);
    const vestingAccount = await withRetry('get vesting account', () => client.getContractState(vestingAddressParsed));
    await sleep(1_500);
    const vestingJettonWalletAddress = await withRetry('get vesting jetton wallet address', () =>
        minter.getWalletAddress(vestingAddressParsed),
    );
    await sleep(1_500);
    const vestingJettonWallet = client.open(DIAOJettonWallet.createFromAddress(vestingJettonWalletAddress));
    const vestingJettonData = await withRetry('get vesting jetton wallet data', () => vestingJettonWallet.getWalletData());

    const maxWithdrawable = vestingAccount.balance > toNano('0.05')
        ? vestingAccount.balance - toNano('0.05')
        : 0n;

    console.log('DIAO mainnet status');
    console.log('  minter:', minterAddressParsed.toString());
    console.log('  vesting:', vestingAddressParsed.toString());
    console.log('  totalSupply:', formatUnits(minterData.totalSupply));
    console.log('  mintable:', minterData.mintable);
    console.log('  saleActive:', vestingData.saleActive);
    console.log('  saleFinalized:', vestingData.saleFinalized);
    console.log('  paused:', vestingData.paused);
    console.log('  funded:', vestingData.funded);
    console.log('  totalPackagesSold:', vestingData.totalPackagesSold);
    console.log('  currentUnlockedRound:', vestingData.currentUnlockedRound);
    console.log('  pendingRound:', vestingData.pendingRound);
    console.log('  admin:', vestingData.adminAddress.toString());
    console.log('  priceAdmin:', vestingData.priceSourceAddress.toString());
    console.log('  treasury:', vestingData.treasuryAddress.toString());
    console.log('  emergencyRescueAddress:', vestingData.emergencyRescueAddress.toString());
    console.log('  emergencyRescued:', formatUnits(vestingData.emergencyRescued));
    console.log('  vestingNativeBalance:', formatUnits(vestingAccount.balance));
    console.log('  maxWithdrawableKeeping0.05:', formatUnits(maxWithdrawable));
    console.log('  vestingJettonWallet:', vestingJettonWalletAddress.toString());
    console.log('  vestingDIAO:', formatUnits(vestingJettonData.jettonBalance));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

```

## Source: Mainnet Wallet-Confirmed Operations Script

File: `contracts/scripts/operateMainnetDIAO.ts`

```ts
import { Address, toNano } from '@ton/core';
import { NetworkProvider } from '@ton/blueprint';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';

const VESTING_ADDRESS = 'EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot';

function targetPriceForRound(round: number) {
    if (!Number.isInteger(round) || round < 1 || round > 18) {
        throw new Error('Round must be an integer from 1 to 18');
    }
    return 10_000_000n * (1n << BigInt(round));
}

function parseCommandArgs() {
    const scriptIndex = process.argv.findIndex((arg) => arg.includes('operateMainnetDIAO'));
    return scriptIndex >= 0 ? process.argv.slice(scriptIndex + 1) : [];
}

export async function run(provider: NetworkProvider) {
    if (provider.network() !== 'mainnet') {
        throw new Error('operateMainnetDIAO must be run with --mainnet');
    }

    const sender = provider.sender();
    if (!sender.address) {
        throw new Error('Sender address is not available. Connect the admin wallet.');
    }

    const vesting = provider.open(DIAOVestingController.createFromAddress(Address.parse(VESTING_ADDRESS)));
    const data = await vesting.getVestingData();
    if (!sender.address.equals(data.adminAddress)) {
        throw new Error(`Connected wallet ${sender.address.toString()} is not admin ${data.adminAddress.toString()}`);
    }

    const args = parseCommandArgs();
    const command = args[0] ?? await provider.ui().input('Command: withdraw-ton | admin | submit-price | execute-unlock');

    if (command === 'withdraw-ton') {
        const amountArg = args[1] ?? await provider.ui().input('Amount to withdraw, e.g. 100');
        const amount = toNano(amountArg);
        provider.ui().write(`Withdrawing ${amountArg} native coin to treasury ${data.treasuryAddress.toString()}`);
        await vesting.sendWithdrawTon(sender, {
            amount,
            value: toNano('0.08'),
            queryId: BigInt(Date.now()),
        });
        provider.ui().write('Withdraw transaction sent. Confirm it in your wallet if prompted.');
        return;
    }

    if (command === 'admin') {
        const actionArg = args[1] ?? await provider.ui().input('Admin action: 1 close, 2 open, 3 pause, 4 unpause, 7 finalize');
        const action = Number(actionArg);
        if (!Number.isInteger(action) || action < 1 || action > 7) {
            throw new Error('Admin action must be an integer from 1 to 7');
        }
        if (action === 5 || action === 6) {
            throw new Error('Action 5/6 requires an address payload and is intentionally not exposed by this simple script.');
        }
        await vesting.sendAdminControl(sender, {
            action,
            value: toNano('0.08'),
            queryId: BigInt(Date.now()),
        });
        provider.ui().write(`Admin action ${action} transaction sent. Confirm it in your wallet if prompted.`);
        return;
    }

    if (command === 'submit-price') {
        const roundArg = args[1] ?? await provider.ui().input('Round 1-18');
        const round = Number(roundArg);
        const price = args[2] ? BigInt(args[2]) : targetPriceForRound(round);
        await vesting.sendSubmitPrice(sender, {
            price,
            targetRound: round,
            value: toNano('0.08'),
            queryId: BigInt(Date.now()),
        });
        provider.ui().write(`Submit price transaction sent for round ${round}. Confirm it in your wallet if prompted.`);
        return;
    }

    if (command === 'execute-unlock') {
        await vesting.sendExecuteUnlock(sender, {
            value: toNano('0.08'),
            queryId: BigInt(Date.now()),
        });
        provider.ui().write('Execute unlock transaction sent. Confirm it in your wallet if prompted.');
        return;
    }

    throw new Error('Unknown command. Use withdraw-ton, admin, submit-price, or execute-unlock.');
}

```

## Source: Testnet Verification Script

File: `contracts/scripts/verifyTestnetDIAO.ts`

```ts
import 'dotenv/config';
import { Address } from '@ton/core';
import { TonClient } from '@ton/ton';
import { DIAOJettonMinter } from '../wrappers/DIAOJettonMinter';
import { DIAOJettonWallet } from '../wrappers/DIAOJettonWallet';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';

const endpoint = process.env.TONCENTER_ENDPOINT ?? 'https://testnet.toncenter.com/api/v2/jsonRPC';
const apiKey = process.env.TONCENTER_API_KEY;
const minterAddress = process.env.DIAO_TESTNET_MINTER;
const vestingAddress = process.env.DIAO_TESTNET_VESTING;
const testnetWallet = process.env.DIAO_TESTNET_WALLET;

if (!minterAddress || !vestingAddress || !testnetWallet) {
    throw new Error('Missing DIAO_TESTNET_MINTER, DIAO_TESTNET_VESTING, or DIAO_TESTNET_WALLET in .env');
}

const resolvedMinterAddress = minterAddress;
const resolvedVestingAddress = vestingAddress;
const resolvedTestnetWallet = testnetWallet;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimitError(error: unknown) {
    const candidate = error as { response?: { status?: number; data?: unknown }; status?: number };
    return candidate.response?.status === 429 || candidate.status === 429;
}

async function withRetry<T>(label: string, action: () => Promise<T>): Promise<T> {
    const delays = [0, 3_000, 8_000, 15_000, 30_000];

    for (let attempt = 0; attempt < delays.length; attempt += 1) {
        if (delays[attempt] > 0) {
            console.log(`${label}: waiting ${delays[attempt] / 1000}s before retry ${attempt}`);
            await sleep(delays[attempt]);
        }

        try {
            return await action();
        } catch (error) {
            if (!isRateLimitError(error) || attempt === delays.length - 1) {
                throw error;
            }
            console.warn(`${label}: Toncenter rate limit, retrying...`);
        }
    }

    throw new Error(`${label}: retry loop exhausted`);
}

async function main() {
    const client = new TonClient({ endpoint, apiKey });
    const minter = client.open(DIAOJettonMinter.createFromAddress(Address.parse(resolvedMinterAddress)));
    const vesting = client.open(DIAOVestingController.createFromAddress(Address.parse(resolvedVestingAddress)));
    const walletOwner = Address.parse(resolvedTestnetWallet);

    const jettonData = await withRetry('get_jetton_data', () => minter.getJettonData());
    await sleep(1_200);
    const vestingData = await withRetry('get_vesting_data', () => vesting.getVestingData());
    await sleep(1_200);

    const circulationWalletAddress = await withRetry('get circulation wallet address', () => minter.getWalletAddress(walletOwner));
    await sleep(1_200);
    const vestingWalletAddress = await withRetry('get vesting wallet address', () =>
        minter.getWalletAddress(Address.parse(resolvedVestingAddress)),
    );

    const circulationWallet = client.open(DIAOJettonWallet.createFromAddress(circulationWalletAddress));
    const vestingWallet = client.open(DIAOJettonWallet.createFromAddress(vestingWalletAddress));

    await sleep(1_200);
    const circulationWalletData = await withRetry('get circulation wallet data', () => circulationWallet.getWalletData());
    await sleep(1_200);
    const vestingWalletData = await withRetry('get vesting wallet data', () => vestingWallet.getWalletData());

    console.log('DIAO testnet verification');
    console.log('Minter:', Address.parse(resolvedMinterAddress).toString());
    console.log('Vesting:', Address.parse(resolvedVestingAddress).toString());
    console.log('Test wallet:', walletOwner.toString());
    console.log('Total supply:', jettonData.totalSupply.toString());
    console.log('Mintable:', jettonData.mintable);
    console.log('Vesting funded:', vestingData.funded);
    console.log('Sale active:', vestingData.saleActive);
    console.log('Current unlocked round:', vestingData.currentUnlockedRound);
    console.log('Emergency rescue address:', vestingData.emergencyRescueAddress.toString());
    console.log('Circulation jetton wallet:', circulationWalletAddress.toString());
    console.log('Circulation wallet DIAO:', circulationWalletData.jettonBalance.toString());
    console.log('Vesting jetton wallet:', vestingWalletAddress.toString());
    console.log('Vesting wallet DIAO:', vestingWalletData.jettonBalance.toString());
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

```

## Source: Testnet Interaction Script

File: `contracts/scripts/interactTestnetDIAO.ts`

```ts
import 'dotenv/config';
import { Address, beginCell, internal, OpenedContract, SendMode, toNano } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { DIAOJettonMinter } from '../wrappers/DIAOJettonMinter';
import { DIAOJettonWallet } from '../wrappers/DIAOJettonWallet';
import { DIAOVestingController } from '../wrappers/DIAOVestingController';

const endpoint = process.env.TONCENTER_ENDPOINT ?? 'https://testnet.toncenter.com/api/v2/jsonRPC';
const apiKey = process.env.TONCENTER_API_KEY;
const minterAddress = process.env.DIAO_TESTNET_MINTER;
const vestingAddress = process.env.DIAO_TESTNET_VESTING;
const expectedWalletAddress = process.env.DIAO_TESTNET_WALLET;
const mnemonic = process.env.MNEMONIC ?? process.env.WALLET_MNEMONIC;

const command = process.argv[2] ?? 'status';
const packageCount = Number(process.argv[3] ?? '1');

if (!minterAddress || !vestingAddress || !expectedWalletAddress || !mnemonic) {
    throw new Error('Missing DIAO_TESTNET_MINTER, DIAO_TESTNET_VESTING, DIAO_TESTNET_WALLET, or MNEMONIC in .env');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimitError(error: unknown) {
    const candidate = error as { code?: string; response?: { status?: number }; status?: number };
    return candidate.response?.status === 429 || candidate.status === 429 || candidate.code === 'ECONNABORTED';
}

async function withRetry<T>(label: string, action: () => Promise<T>): Promise<T> {
    const delays = [0, 3_000, 8_000, 15_000, 30_000];

    for (let attempt = 0; attempt < delays.length; attempt += 1) {
        if (delays[attempt] > 0) {
            console.log(`${label}: waiting ${delays[attempt] / 1000}s before retry ${attempt}`);
            await sleep(delays[attempt]);
        }

        try {
            return await action();
        } catch (error) {
            if (!isRateLimitError(error) || attempt === delays.length - 1) {
                throw error;
            }
            console.warn(`${label}: Toncenter rate limit, retrying...`);
        }
    }

    throw new Error(`${label}: retry loop exhausted`);
}

async function waitForSeqno(wallet: OpenedContract<WalletContractV4>, previousSeqno: number) {
    for (let i = 0; i < 30; i += 1) {
        await sleep(2_000);
        const currentSeqno = await withRetry('get wallet seqno', () => wallet.getSeqno());
        if (currentSeqno > previousSeqno) {
            return currentSeqno;
        }
    }

    throw new Error('Timed out waiting for wallet seqno change');
}

function formatDiao(amount: bigint) {
    const whole = amount / 1_000_000_000n;
    const fractional = amount % 1_000_000_000n;
    if (fractional === 0n) {
        return whole.toString();
    }
    return `${whole}.${fractional.toString().padStart(9, '0').replace(/0+$/, '')}`;
}

function targetPriceForRound(round: number) {
    if (!Number.isInteger(round) || round < 1 || round > 18) {
        throw new Error('Round must be an integer from 1 to 18');
    }

    return 10_000_000n * (1n << BigInt(round));
}

function parseDiaoAmount(input: string) {
    if (!/^\d+(\.\d{1,9})?$/.test(input)) {
        throw new Error('DIAO amount must be a positive decimal with up to 9 decimals');
    }

    const [whole, fractional = ''] = input.split('.');
    return BigInt(whole) * 1_000_000_000n + BigInt(fractional.padEnd(9, '0'));
}

async function readState(
    client: TonClient,
    walletOwner: Address,
    minter: OpenedContract<DIAOJettonMinter>,
    vesting: OpenedContract<DIAOVestingController>,
) {
    const vestingData = await withRetry('get vesting data', () => vesting.getVestingData());
    await sleep(1_200);
    const userPackages = await withRetry('get user packages', () => vesting.getUserPackages(walletOwner));
    await sleep(1_200);
    const userJettonWalletAddress = await withRetry('get user jetton wallet address', () => minter.getWalletAddress(walletOwner));
    const userJettonWallet = client.open(DIAOJettonWallet.createFromAddress(userJettonWalletAddress));
    await sleep(1_200);
    const userJettonData = await withRetry('get user jetton wallet data', () => userJettonWallet.getWalletData());
    await sleep(1_200);
    const vestingJettonWalletAddress = await withRetry('get vesting jetton wallet address', () =>
        minter.getWalletAddress(Address.parse(vestingAddress!)),
    );
    const vestingJettonWallet = client.open(DIAOJettonWallet.createFromAddress(vestingJettonWalletAddress));
    await sleep(1_200);
    const vestingJettonData = await withRetry('get vesting jetton wallet data', () => vestingJettonWallet.getWalletData());

    return {
        vestingData,
        userPackages,
        userJettonWalletAddress,
        userDiaoBalance: userJettonData.jettonBalance,
        vestingJettonWalletAddress,
        vestingDiaoBalance: vestingJettonData.jettonBalance,
    };
}

async function printState(state: Awaited<ReturnType<typeof readState>>) {
    console.log('Vesting status');
    console.log('  saleActive:', state.vestingData.saleActive);
    console.log('  saleFinalized:', state.vestingData.saleFinalized);
    console.log('  paused:', state.vestingData.paused);
    console.log('  funded:', state.vestingData.funded);
    console.log('  totalPackagesSold:', state.vestingData.totalPackagesSold);
    console.log('  currentUnlockedRound:', state.vestingData.currentUnlockedRound);
    console.log('  pendingRound:', state.vestingData.pendingRound);
    console.log('  emergencyRescueAddress:', state.vestingData.emergencyRescueAddress.toString());
    console.log('  emergencyRescued:', formatDiao(state.vestingData.emergencyRescued));
    console.log('User status');
    console.log('  packageCount:', state.userPackages.packageCount);
    console.log('  highestClaimedRound:', state.userPackages.highestClaimedRound);
    console.log('  userJettonWallet:', state.userJettonWalletAddress.toString());
    console.log('  userDIAO:', formatDiao(state.userDiaoBalance));
    console.log('Vesting wallet');
    console.log('  vestingJettonWallet:', state.vestingJettonWalletAddress.toString());
    console.log('  vestingDIAO:', formatDiao(state.vestingDiaoBalance));
}

async function sendMessageAndWait(
    label: string,
    openedWallet: OpenedContract<WalletContractV4>,
    secretKey: Buffer,
    message: ReturnType<typeof internal>,
) {
    const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
    await withRetry(label, () => openedWallet.sendTransfer({
        seqno,
        secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY,
        messages: [message],
    }));
    const nextSeqno = await waitForSeqno(openedWallet, seqno);
    console.log('Wallet seqno changed:', seqno, '->', nextSeqno);
}

async function main() {
    const keyPair = await mnemonicToPrivateKey(mnemonic!.trim().split(/\s+/));
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
    const parsedExpectedWallet = Address.parse(expectedWalletAddress!);

    if (!wallet.address.equals(parsedExpectedWallet)) {
        throw new Error(`Mnemonic wallet ${wallet.address.toString()} does not match DIAO_TESTNET_WALLET ${parsedExpectedWallet.toString()}`);
    }

    const client = new TonClient({ endpoint, apiKey });
    const openedWallet = client.open(wallet);
    const sender = openedWallet.sender(keyPair.secretKey);
    const minter = client.open(DIAOJettonMinter.createFromAddress(Address.parse(minterAddress!)));
    const vesting = client.open(DIAOVestingController.createFromAddress(Address.parse(vestingAddress!)));

    console.log('DIAO testnet interaction');
    console.log('Command:', command);
    console.log('Wallet:', wallet.address.toString());
    console.log('Minter:', Address.parse(minterAddress!).toString());
    console.log('Vesting:', Address.parse(vestingAddress!).toString());

    if (command === 'status') {
        await printState(await readState(client, wallet.address, minter, vesting));
        return;
    }

    if (command === 'buy') {
        if (!Number.isInteger(packageCount) || packageCount < 1 || packageCount > 10) {
            throw new Error('Package count must be an integer from 1 to 10');
        }

        const before = await readState(client, wallet.address, minter, vesting);
        console.log('Before buy');
        await printState(before);

        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        const value = toNano(58 * packageCount) + toNano('0.25');

        console.log(`Sending buyPackage(${packageCount}) with ${value.toString()} nanotons...`);
        await withRetry('send buy package transfer', () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value,
                    body: beginCell()
                        .storeUint(0x42555950, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .storeUint(packageCount, 8)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);

        await sleep(12_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log('After buy');
        await printState(after);

        console.log('DIAO delta:', formatDiao(after.userDiaoBalance - before.userDiaoBalance));
        console.log('Package delta:', after.userPackages.packageCount - before.userPackages.packageCount);
        return;
    }

    if (command === 'submit-price') {
        const round = Number(process.argv[3] ?? '1');
        const price = process.argv[4] ? BigInt(process.argv[4]) : targetPriceForRound(round);
        const before = await readState(client, wallet.address, minter, vesting);
        console.log('Before submit-price');
        await printState(before);

        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        const value = toNano('0.08');

        console.log(`Submitting price for round ${round}: ${price.toString()}`);
        await withRetry('send submit price transfer', () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value,
                    body: beginCell()
                        .storeUint(0x53554250, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .storeUint(price, 64)
                        .storeUint(round, 8)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);

        await sleep(8_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log('After submit-price');
        await printState(after);
        return;
    }

    if (command === 'execute-unlock') {
        const before = await readState(client, wallet.address, minter, vesting);
        console.log('Before execute-unlock');
        await printState(before);

        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        console.log('Executing pending unlock...');
        await withRetry('send execute unlock transfer', () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value: toNano('0.08'),
                    body: beginCell()
                        .storeUint(0x4558554e, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);

        await sleep(8_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log('After execute-unlock');
        await printState(after);
        return;
    }

    if (command === 'claim-buyer') {
        const before = await readState(client, wallet.address, minter, vesting);
        console.log('Before claim-buyer');
        await printState(before);

        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        console.log('Claiming buyer unlocked DIAO...');
        await withRetry('send claim buyer transfer', () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value: toNano('0.2'),
                    body: beginCell()
                        .storeUint(0x434c6275, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);

        await sleep(8_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log('After claim-buyer');
        await printState(after);
        console.log('DIAO delta:', formatDiao(after.userDiaoBalance - before.userDiaoBalance));
        return;
    }

    if (command === 'claim-reserve' || command === 'claim-team') {
        const isReserve = command === 'claim-reserve';
        const before = await readState(client, wallet.address, minter, vesting);
        console.log(`Before ${command}`);
        await printState(before);

        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        console.log(`Sending ${command}...`);
        await withRetry(`send ${command} transfer`, () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value: toNano('0.25'),
                    body: beginCell()
                        .storeUint(isReserve ? 0x434c7265 : 0x434c746d, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);

        await sleep(8_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log(`After ${command}`);
        await printState(after);
        console.log('DIAO delta:', formatDiao(after.userDiaoBalance - before.userDiaoBalance));
        return;
    }

    if (command === 'admin') {
        const action = Number(process.argv[3]);
        if (!Number.isInteger(action) || action < 1 || action > 7) {
            throw new Error('Admin action must be an integer from 1 to 7');
        }

        const before = await readState(client, wallet.address, minter, vesting);
        console.log('Before admin action');
        await printState(before);

        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        console.log(`Sending admin action ${action}...`);
        await withRetry('send admin transfer', () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value: toNano('0.08'),
                    body: beginCell()
                        .storeUint(0x41444d43, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .storeUint(action, 8)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);

        await sleep(8_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log('After admin action');
        await printState(after);
        return;
    }

    if (command === 'withdraw-ton') {
        const amount = toNano(process.argv[3] ?? '1');
        const seqno = await withRetry('get wallet seqno', () => openedWallet.getSeqno());
        console.log(`Withdrawing ${amount.toString()} nanotons to treasury...`);
        await withRetry('send withdraw transfer', () => openedWallet.sendTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            messages: [
                internal({
                    to: Address.parse(vestingAddress!),
                    value: toNano('0.08'),
                    body: beginCell()
                        .storeUint(0x5744544f, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .storeCoins(amount)
                        .endCell(),
                }),
            ],
        }));

        const nextSeqno = await waitForSeqno(openedWallet, seqno);
        console.log('Wallet seqno changed:', seqno, '->', nextSeqno);
        return;
    }

    if (command === 'rescue-diao') {
        const amount = parseDiaoAmount(process.argv[3] ?? '1');
        const recipient = wallet.address;
        const before = await readState(client, wallet.address, minter, vesting);
        console.log('Before rescue-diao');
        await printState(before);

        if (!before.vestingData.paused) {
            throw new Error('Vesting must be paused before rescue-diao. Run: npm run interact:testnet -- admin 3');
        }
        if (!before.vestingData.emergencyRescueAddress.equals(recipient)) {
            throw new Error(`Testnet rescue recipient mismatch. Expected ${before.vestingData.emergencyRescueAddress.toString()}, got ${recipient.toString()}`);
        }

        await sendMessageAndWait(
            'send emergency rescue transfer',
            openedWallet,
            keyPair.secretKey,
            internal({
                to: Address.parse(vestingAddress!),
                value: toNano('0.25'),
                body: beginCell()
                    .storeUint(0x45525351, 32)
                    .storeUint(BigInt(Date.now()), 64)
                    .storeAddress(recipient)
                    .storeCoins(amount)
                    .endCell(),
            }),
        );

        await sleep(8_000);
        const after = await readState(client, wallet.address, minter, vesting);
        console.log('After rescue-diao');
        await printState(after);
        console.log('DIAO delta:', formatDiao(after.userDiaoBalance - before.userDiaoBalance));
        return;
    }

    if (command === 'unlock-to') {
        const targetRound = Number(process.argv[3]);
        if (!Number.isInteger(targetRound) || targetRound < 1 || targetRound > 18) {
            throw new Error('Target round must be an integer from 1 to 18');
        }

        let state = await readState(client, wallet.address, minter, vesting);
        await printState(state);

        while (state.vestingData.currentUnlockedRound < targetRound) {
            const nextRound = state.vestingData.currentUnlockedRound + 1;
            if (state.vestingData.pendingRound === 0) {
                const price = targetPriceForRound(nextRound);
                console.log(`Submitting round ${nextRound} price ${price.toString()}...`);
                await sendMessageAndWait(
                    'send submit price transfer',
                    openedWallet,
                    keyPair.secretKey,
                    internal({
                        to: Address.parse(vestingAddress!),
                        value: toNano('0.08'),
                        body: beginCell()
                            .storeUint(0x53554250, 32)
                            .storeUint(BigInt(Date.now()), 64)
                            .storeUint(price, 64)
                            .storeUint(nextRound, 8)
                            .endCell(),
                    }),
                );
            } else if (state.vestingData.pendingRound !== nextRound) {
                throw new Error(`Unexpected pending round ${state.vestingData.pendingRound}; expected ${nextRound}`);
            } else {
                console.log(`Round ${nextRound} already pending; executing it next.`);
            }

            console.log('Waiting 18s for testnet cooldown...');
            await sleep(18_000);

            console.log(`Executing round ${nextRound} unlock...`);
            await sendMessageAndWait(
                'send execute unlock transfer',
                openedWallet,
                keyPair.secretKey,
                internal({
                    to: Address.parse(vestingAddress!),
                    value: toNano('0.08'),
                    body: beginCell()
                        .storeUint(0x4558554e, 32)
                        .storeUint(BigInt(Date.now()), 64)
                        .endCell(),
                }),
            );

            await sleep(8_000);
            state = await readState(client, wallet.address, minter, vesting);
            console.log(`After round ${nextRound}`);
            await printState(state);
        }

        return;
    }

    throw new Error(
        `Unknown command: ${command}. Use "status", "buy [1-10]", "submit-price [round] [price]", "execute-unlock", "claim-buyer", "claim-reserve", "claim-team", "admin [1-7]", "withdraw-ton [amount]", "rescue-diao [amount]", or "unlock-to [round]".`,
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

```

