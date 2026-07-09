# DIAO Launch QA And Operations Checklist

Last updated: 2026-07-09

This document is the operational checklist for the Cloudflare preview and launch path. It does not include private keys, mnemonics, API tokens, or wallet secrets.

## Current Status

Preview deployment is usable for basic public checks:

- Cloudflare Pages project: `diao-tg-app`
- Production URL: `https://diao-tg-app.pages.dev`
- TonConnect manifest: `https://diao-tg-app.pages.dev/tonconnect-manifest.json`
- Main battlefield opens directly, without the old splash/gate flow.
- DIAO logo is used for page metadata, TonConnect manifest, and app header.
- Backend public health/data routes respond on preview.

Recent code fixes before the next deploy:

- `NEXT_PUBLIC_USE_API_ADAPTER=true` now enables same-origin API calls even when `NEXT_PUBLIC_API_BASE_URL` is empty.
- Loss screenshot upload now preserves the browser `File.arrayBuffer()` reader, so the R2 upload path can actually send image bytes instead of falling back to mock state.

## Launch Blockers

These items must pass before open promotion:

1. Real mobile wallet connection
   - Test Tonkeeper on iOS/Android.
   - Test OKX Wallet.
   - Confirm the wallet prompt shows the DIAO logo, correct domain, and expected app name.

2. Purchase prompt verification
   - Use one wallet and create a 1-package purchase intent.
   - Stop at the wallet confirmation screen unless the operator explicitly approves spending.
   - Confirm receiver is the mainnet Vesting Controller.
   - Confirm amount is the expected package payment plus gas buffer.
   - Confirm payload opcode is `BuyPackage`.

3. Chain confirmation
   - If a real purchase is signed, confirm `/api/purchases/confirm` moves the intent to `confirmed`.
   - Confirm `diao_purchases` has exactly one ledger row for the transaction hash.
   - Confirm duplicate confirmation with the same hash is rejected.

4. Loss proof upload and review
   - Upload a PNG/JPEG/WebP from a real browser/mobile session.
   - Confirm an object exists in R2 under `claims/<user-id>/...`.
   - Confirm `loss_claims.status` becomes `pending_review`.
   - Confirm the operator can view the image and manually approve/reject the claim.
   - If Agnes AI is enabled, confirm `AGNES_AI_BASE_URL`, `AGNES_AI_API_KEY`, `AGNES_AI_VISION_MODEL`, and `AGNES_AI_TASK_VERIFY_MODEL` are configured as server-only Cloudflare variables.

5. Share flow
   - Test Telegram share.
   - Test X share.
   - Test Binance Square share.
   - Configure `NEXT_PUBLIC_OKX_PLANET_URL` before exposing OKX Planet sharing, or keep the UI fallback message.

6. Telegram Mini App auth, if Telegram launch is required
   - Configure `TELEGRAM_BOT_TOKEN`.
   - Configure bot username and Mini App URL in BotFather.
   - Verify `/api/auth/telegram` returns a real session from signed initData.
   - Browser fallback can be used for web preview, but Telegram launch should not rely on missing bot config.

## Manual Loss Claim Review

Until an admin review UI is built, review through D1 and R2 operations.

The project also exposes a minimal protected review API. Configure `ADMIN_REVIEW_TOKEN` as a server-only Cloudflare variable, then send it as:

```bash
Authorization: Bearer <ADMIN_REVIEW_TOKEN>
```

List pending claims:

```bash
curl -H "Authorization: Bearer $ADMIN_REVIEW_TOKEN" \
  "https://diao-tg-app.pages.dev/api/admin/loss-claims?status=pending_review"
```

Approve a claim:

```bash
curl -X PATCH \
  -H "Authorization: Bearer $ADMIN_REVIEW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"<claim-id>","status":"verified","amountUsd":8361,"exchange":"Binance","reason":"人工审核通过。"}' \
  "https://diao-tg-app.pages.dev/api/admin/loss-claims"
```

Reject a claim:

```bash
curl -X PATCH \
  -H "Authorization: Bearer $ADMIN_REVIEW_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id":"<claim-id>","status":"rejected","reason":"截图不清晰，请重新上传。"}' \
  "https://diao-tg-app.pages.dev/api/admin/loss-claims"
```

List pending claims:

```sql
SELECT
  id,
  user_id,
  r2_object_key,
  original_file_name,
  amount_usd,
  exchange,
  amount_confidence,
  review_status_reason,
  created_at,
  updated_at
FROM loss_claims
WHERE status = 'pending_review'
ORDER BY created_at ASC;
```

Approve a claim after manual verification:

```sql
UPDATE loss_claims
SET
  status = 'verified',
  amount_usd = ?,
  exchange = ?,
  amount_confidence = 1,
  review_status_reason = '人工审核通过。',
  updated_at = datetime('now')
WHERE id = ?;
```

`amount_usd` is stored in cents. For example, `$8,361` must be stored as `836100`.

Reject a claim:

```sql
UPDATE loss_claims
SET
  status = 'rejected',
  review_status_reason = ?,
  updated_at = datetime('now')
WHERE id = ?;
```

Operational rule: never set a claim to `verified` only from OCR output. OCR is a suggestion; manual review is the release gate.

## Remote Smoke Test

Run after every preview deploy:

```bash
curl -I https://diao-tg-app.pages.dev/
curl -I https://diao-tg-app.pages.dev/icon.png
curl https://diao-tg-app.pages.dev/tonconnect-manifest.json
curl https://diao-tg-app.pages.dev/api/health
curl https://diao-tg-app.pages.dev/api/price/diao
curl https://diao-tg-app.pages.dev/api/battlefield/data
```

Expected:

- HTML and icon routes return `200`.
- Manifest name/url/icon use `https://diao-tg-app.pages.dev`.
- Health reports `db`, `r2`, and `ai` as available or explicitly degraded.
- Battlefield data returns JSON and does not throw.

## Local Verification

When dependencies are installed and network is available:

```bash
pnpm install
CI=true pnpm typecheck
CI=true pnpm lint
CI=true pnpm run verify:backend
```

If local `pnpm` tries to rebuild `node_modules`, it needs npm registry access. A failed DNS lookup during package download is an environment/network issue, not automatically a code failure.

## Recommended Next Engineering Work

1. Add a minimal admin review surface or protected script for `loss_claims`.
2. Add a preview E2E script that creates a browser session, uploads a small test image, and verifies R2 + D1 state.
3. Add real-device QA notes for Tonkeeper and OKX Wallet.
4. Add a post-purchase polling status component that clearly distinguishes wallet-signed, broadcasted, pending chain scan, confirmed, failed, and expired.
5. Add a lightweight social proof feed on the battlefield from confirmed purchases and verified losses, without bringing back the removed dog den flow.
