# Frontend Integration Notes

This document is the handoff point between the frontend owner and the backend thread.

## Ownership Boundary

Frontend owns:

- UI states, copy, responsive behavior, and Telegram Mini App display behavior.
- `lib/api-client.ts` request wrapper and endpoint path constants.
- `lib/services.ts` adapter boundary and demo fallback behavior.
- Acceptance against `docs/api-contract.md`.

Backend owns:

- Cloudflare bindings, D1 migrations, R2 upload/storage, Workers AI/OCR, and Telegram `initData` verification.
- API route implementation under the agreed paths in `API_PATHS`.
- Returning response shapes that match `lib/business-types.ts` and `docs/api-contract.md`.

## Current Adapter State

The environment template keeps the API adapter disabled by default so local UI work can fall back to demo data safely:

```env
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_USE_API_ADAPTER=false
```

For a validated Cloudflare Pages deployment, set `NEXT_PUBLIC_USE_API_ADAPTER=true` and keep `NEXT_PUBLIC_API_BASE_URL` empty for same-origin routing.

### Production Configuration Guide

When endpoints are ready and deployed:

1. **API Base URL Routing**:
   - **Same-Origin Deployment (Recommended)**: If the Next.js frontend and the Cloudflare API routes are deployed under the same domain, keep `NEXT_PUBLIC_API_BASE_URL` empty or unset. All calls will resolve relatively (e.g. `/api/health`).
   - **Cross-Origin Deployment**: Set `NEXT_PUBLIC_API_BASE_URL` to your full domain (e.g., `https://api.gou.finance`) or `http://127.0.0.1:3001` for local Wrangler Pages dev.
2. **Enable Adapter**: Set `NEXT_PUBLIC_USE_API_ADAPTER=true` only after the Cloudflare preview or production deployment passes `/api/health`, screenshot upload, and token sale intent checks.
3. **Telegram Verification**: Make sure to set a secret `TELEGRAM_BOT_TOKEN` in the production environment. Telegram auth routes verify login requests against this token and will reject requests if it is empty.
4. **DIAO Sale Wallets**: Ensure `DIAO_SALE_TON_RECEIVER`, `DIAO_MINTER_ADDRESS`, `DIAO_VESTING_ADDRESS`, `DIAO_INITIAL_CIRCULATION_WALLET`, `DIAO_OFFICIAL_RESERVE_WALLET`, `DIAO_TREASURY_WALLET`, `DIAO_TEAM_WALLET`, `DIAO_ADMIN_WALLET`, and `DIAO_PRICE_ADMIN_WALLET` are configured in Pages variables before launching the public round. Mainnet contracts are deployed; until backend chain sync and allocation settlement are verified, the UI must stay in purchase-intent mode.
5. Verify build status: Run `pnpm lint`, `pnpm typecheck`, and `pnpm exec next-on-pages`.

## Do Not Bypass The Adapter

Components should not call `fetch` directly for business data. Add API calls inside `lib/services.ts` or helper functions behind `lib/api-client.ts`, then map responses into `lib/business-types.ts`.

## Loss Claim Upload Workflow

The production loss-proof screenshot uploading and OCR review workflow is implemented end-to-end for Cloudflare Pages Functions:

1. **Get Upload URL**: `POST /api/loss-proofs/upload-url` (registers metadata like mime/size in D1, calculates an `expires_at` timestamp, and returns the unique R2 object `key` and target proxy url).
2. **Write Binary to Storage**: `PUT /api/loss-proofs/upload?key=...` (directly stream image binary data to the R2 bucket. Access is secured via session checks. Upon successful write, the claim status automatically advances to `'uploaded'`).
3. **Submit for Audit**: `POST /api/loss-proofs/submit` with `objectKey` (triggers Workers AI multimodal models to generate OCR suggestions for loss amount and source exchanges. Re-aligns status to `'pending_review'` for manual admin confirmation).

## DIAO Sale Boundary

The current DIAO sale flow creates purchase intents only:

- Package terms follow the mainnet contract configuration: `58 TON`, `200,000 DIAO` immediate, `3,000,000 DIAO` locked, 15 participant release rounds.
- The DIAO mainnet contracts are deployed. The sale receiver is the Vesting Controller: `EQCaEIglj5ut5U-y4aMAz45Dj1Gx3JJ_8JUilNs-jvfl_Cot`.
- The frontend and `/api/token-sale/intent` must not mark purchases as settled until chain payment confirmation and allocation ledger are implemented.
- Chain payment confirmation and ledger settlement are owned by the backend contract integration task in `docs/backend-contract-integration-prompt.md`.
