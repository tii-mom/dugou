# DIAO TON Smart Contracts

DIAO Jetton and Vesting contracts on TON blockchain, built with **Tolk** and **Blueprint**.

## Architecture

```
┌──────────────────────┐       ┌──────────────────────────┐
│   DIAOJettonMinter   │──────▶│   DIAOJettonWallet (×N)  │
│  (Total: 10B DIAO)   │       │  (per user/contract)     │
└──────────┬───────────┘       └──────────────────────────┘
           │ init_mint (one-time)
           │
           ▼
┌──────────────────────────┐
│  DIAOVestingController   │
│  (Holds 9B DIAO locked)  │
│                          │
│  • BuyPackage (58 TON)   │
│  • SubmitPrice / Unlock  │
│  • ClaimBuyer            │
│  • ClaimReserve          │
│  • ClaimTeam             │
│  • AdminControl          │
│  • WithdrawTon           │
└──────────────────────────┘
```

## Supply Distribution

| Bucket | Amount | Mechanism |
|--------|--------|-----------|
| Initial Circulation | 1,000,000,000 DIAO | Sent to circulation wallet at init_mint |
| Buyer Packages | Up to 6,400,000,000 DIAO | 2000 packages × 3,200,000 DIAO each |
| Official Reserve | Remainder after sale | Linear release over 15 rounds |
| Team | 500,000,000 DIAO per round | Rounds 16-18 only |

## Package Mechanics

- **Price**: 58 TON per package
- **Immediate unlock**: 200,000 DIAO (sent on purchase)
- **Locked**: 3,000,000 DIAO (200,000 per round × 15 rounds)
- **Limit**: 10 packages per wallet, 2000 total

## Round Unlock Flow

1. **Price admin** calls `submit_price(targetRound, price)` — starts 24h cooldown
2. After 24h cooldown (and within 48h), anyone calls `execute_unlock` — unlocks the round
3. Users can then `claim_buyer` to receive their unlocked tokens

## Prerequisites

- Node.js ≥ 18
- npm or yarn

## Setup

```bash
cd contracts
npm install
```

## Build

```bash
npx blueprint build --all
```

## Test

```bash
npx jest
```

### Test Suites

| Suite | Tests | Description |
|-------|-------|-------------|
| `diao_supply.spec.ts` | 3 | init_mint, supply locking, re-mint prevention, underfunded init safety |
| `diao_purchase.spec.ts` | 7 | Package purchase, limits, finalize, admin controls, withdraw |
| `diao_unlock.spec.ts` | 8 | Price submission, round unlock, buyer/reserve/team claims, supply conservation, permissions, pause |

## Deploy

### Testnet

```bash
npx blueprint run deployDIAOJettonMinter --testnet
```

### Mainnet

```bash
npx blueprint run deployDIAOJettonMinter --mainnet
```

The deploy script will:
1. Compile all contracts
2. Deploy Jetton Minter
3. Deploy Vesting Controller
4. Call `init_mint` (1B → circulation, 9B → vesting, minter locks)
5. Transfer minter admin to operational admin wallet

## Contract Files

```
contracts/
├── contracts/
│   ├── diao_config.tolk          # Shared constants
│   ├── diao_jetton_minter.tolk   # Jetton Minter (TEP-74)
│   ├── diao_jetton_wallet.tolk   # Jetton Wallet (TEP-74)
│   └── diao_vesting_controller.tolk  # Vesting & sale logic
├── wrappers/
│   ├── config.ts                 # Wallet addresses
│   ├── DIAOJettonMinter.ts       # Minter wrapper
│   ├── DIAOJettonWallet.ts       # Wallet wrapper (read-only)
│   └── DIAOVestingController.ts  # Vesting wrapper
├── tests/
│   ├── diao_supply.spec.ts       # Supply & init tests
│   ├── diao_purchase.spec.ts     # Purchase & admin tests
│   └── diao_unlock.spec.ts       # Unlock & claim tests
└── scripts/
    └── deployDIAOJettonMinter.ts # Full deployment script
```

## Admin Operations

After deployment, the admin wallet can control the Vesting Controller:

| Action | Code | Description |
|--------|------|-------------|
| Close Sale | 1 | Temporarily pause new purchases |
| Open Sale | 2 | Resume purchases |
| Pause | 3 | Pause all claims and purchases |
| Unpause | 4 | Resume operations |
| Update Price Admin | 5 | Change price submission address |
| Update Price Source | 6 | Change price oracle address |
| Finalize Sale | 7 | Permanently end sale (irreversible) |

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 77 | ERR_INVALID_PAYLOAD | Invalid message payload |
| 101 | ERR_NOT_FROM_ADMIN | Sender is not admin |
| 102 | ERR_NOT_FROM_PRICE_ADMIN | Sender is not price admin |
| 103 | ERR_SALE_NOT_ACTIVE | Sale is not open |
| 104 | ERR_SALE_FINALIZED | Sale already finalized |
| 105 | ERR_USER_LIMIT_EXCEEDED | 10 per-wallet limit reached |
| 106 | ERR_TOTAL_LIMIT_EXCEEDED | 2000 package limit reached |
| 107 | ERR_INSUFFICIENT_PAYMENT | Not enough TON sent |
| 108 | ERR_NOT_FUNDED | Vesting not funded yet |
| 109 | ERR_PAUSED | Contract is paused |
| 110 | ERR_COOLDOWN_NOT_MET | Manual price cooldown not elapsed |
| 111 | ERR_PRICE_EXPIRED | Price submission expired (48h) |
| 112 | ERR_ROUND_ALREADY_UNLOCKED | Round already unlocked |
| 113 | ERR_INVALID_ROUND | Invalid round number |
| 114 | ERR_PRICE_TOO_LOW | Price below round threshold |
| 115 | ERR_NOT_FROM_OFFICIAL_RESERVE | Sender is not official reserve |
| 116 | ERR_NOT_FROM_TEAM | Sender is not team wallet |
| 117 | ERR_NOTHING_TO_CLAIM | No tokens available to claim |
| 118 | ERR_SALE_NOT_FINALIZED | Sale not finalized yet |
| 119 | ERR_NOT_ENOUGH_TON | Insufficient TON for gas |
