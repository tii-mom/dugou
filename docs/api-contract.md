# API Contract

This document defines the frontend-facing contract for the backend thread. It is intentionally implementation-neutral: no Worker, D1, R2, OCR, or auth code is defined here.

## Global Rules

- All authenticated endpoints must verify Telegram `initData` on the server.
- Frontend display must never trust `initDataUnsafe` for identity, permissions, balances, or review state.
- Every response that can contain demo data must mark `source` or `mode` as `demo`.
- Amounts should use integer USD cents server-side. The current frontend `amountUsd` remains whole USD for display until backend integration normalizes units.
- Exchange source is derived from the uploaded screenshot review result, not from user-entered text.
- Low-confidence OCR/review results must return `pending_review`, not `verified`.

## Shared Types

```ts
type DataMode = "demo" | "api"

type ExchangeSource =
  | "Binance"
  | "OKX"
  | "Bybit"
  | "Bitget"
  | "Gate"
  | "Hyperliquid"
  | "Other"
  | "Unknown"

type LossProofStatus =
  | "not_submitted"
  | "pending_review"
  | "verified"
  | "rejected"
  | "demo_estimate"
```

## Loss Claim

```ts
type LossClaim = {
  status: LossProofStatus
  amountUsd: number | null
  certificateNo: string | null
  exchange?: ExchangeSource
  confidence?: number
  fileName?: string
  message: string
  source: DataMode
}
```

`exchange` is required when the backend can identify the exchange from screenshot evidence. Use `Unknown` when the screenshot was readable but no exchange could be determined.

`confidence` is a number from `0` to `1`. Values below the backend review threshold should keep the claim in `pending_review`.

## Endpoints

### `POST /api/auth/telegram`

Request:

```json
{
  "initData": "telegram-init-data"
}
```

Response:

```json
{
  "user": {
    "id": "user_id",
    "telegramId": "123456",
    "username": "optional_username"
  },
  "session": {
    "expiresAt": "2026-07-09T00:00:00.000Z"
  },
  "source": "api"
}
```

### `GET /api/me/session`

Response:

```json
{
  "lossClaim": {
    "status": "pending_review",
    "amountUsd": null,
    "certificateNo": null,
    "exchange": "Binance",
    "confidence": 0.82,
    "fileName": "screenshot.png",
    "message": "截图已提交，等待审核确认。",
    "source": "api"
  },
  "lockedGBalance": 0,
  "streakDays": 0,
  "diaoPriceUsd": 0.042,
  "diaoHighestPriceUsd": 0.042
}
```

### `POST /api/loss-proofs/upload-url`

Request:

```json
{
  "fileName": "screenshot.png",
  "mimeType": "image/png",
  "fileSize": 123456
}
```

Response:

```json
{
  "uploadUrl": "https://...",
  "objectKey": "loss-proofs/user/date/id.png",
  "expiresAt": "2026-07-08T12:30:00.000Z"
}
```

### `POST /api/loss-proofs/submit`

Request:

```json
{
  "objectKey": "loss-proofs/user/date/id.png",
  "originalFileName": "screenshot.png"
}
```

Response:

```json
{
  "lossClaim": {
    "status": "pending_review",
    "amountUsd": null,
    "certificateNo": null,
    "exchange": "OKX",
    "confidence": 0.74,
    "fileName": "screenshot.png",
    "message": "已识别交易所来源，金额等待审核确认。",
    "source": "api"
  }
}
```

### `GET /api/community`

Return team and invite data. If backend data is incomplete, return `mode: "demo"` and keep names clearly demo-scoped.

### `GET /api/honor`

Leaderboard rows should include exchange-derived display names.

```ts
type LossLeaderboardRow = {
  rank: number
  name: string
  exchange?: ExchangeSource
  amount: number
  source: DataMode
}
```

### `POST /api/deposits/check`

No C2C or direct payment flow. This endpoint can only confirm backend-recognized records. If unavailable, return `pending_settlement` or `unavailable` with a clear message.

### `POST /api/claims/unlocked`

Creates an audit request only. It must not trigger automatic transfer or imply instant settlement.

### `POST /api/token-sale/intent`

Creates an official DIAO sale purchase intent only. It must not trigger automatic TON transfer, token transfer, custody, or settlement.

Request:

```json
{
  "walletAddress": "EQ...",
  "packages": 1
}
```

Rules:

- One package costs `58 TON`.
- The on-chain purchase must include the contract execution buffer: `package_count * 58 TON + 0.1 TON`.
- One package records `200,000 DIAO` immediate allocation and `3,000,000 DIAO` locked allocation.
- Locked allocation releases across 15 participant rounds, `200,000 DIAO` per round per package.
- A single wallet can request at most 10 packages.
- The sale contract accepts at most 2,000 packages globally.
- Backend must bind the intent to a verified Telegram user before production enablement.

Response:

```json
{
  "intent": {
    "intentId": "diao-sale-...",
    "walletAddress": "EQ...",
    "packages": 1,
    "totalTon": 58,
    "contractGasBufferTon": 0.1,
    "contractRequiredTon": 58.1,
    "immediateDIAO": 200000,
    "lockedDIAO": 3000000,
    "perRoundDIAO": 200000,
    "status": "pending_contract_payment",
    "message": "已创建购买意向，等待官方合约与后端确认。",
    "source": "api"
  }
}
```

## Frontend Integration Boundary

- `lib/services.ts` remains the adapter boundary.
- `demoBusinessService` stays available as fallback.
- `apiBusinessService` is gated by `NEXT_PUBLIC_USE_API_ADAPTER=true` and `NEXT_PUBLIC_API_BASE_URL`.
- The adapter must stay disabled in the default template and should be enabled only after the Cloudflare deployment passes the documented endpoint checks.
- The screenshot submit adapter uses the implemented R2 upload URL, upload proxy, and submit flow.
- The token sale intent endpoint should now reference the deployed DIAO mainnet contracts and still record purchase intent until chain payment confirmation and allocation ledger settlement are implemented.
- DIAO mainnet minter: `EQDO5Wl-jFR2A9UrgZZKqQbV_2Ab56HZqMbVbj3G2noXJq3Y`
- DIAO mainnet vesting / sale receiver: `EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot`
- API failures should degrade to demo/empty states, never a blank screen.
