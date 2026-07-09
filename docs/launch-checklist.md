# Launch Checklist

This checklist tracks frontend readiness and cross-thread acceptance. Backend implementation is owned by the backend thread; this thread owns frontend contract, UI states, copy, and final acceptance.

## Frontend

- [x] High-risk copy removed or softened: no visible city sources, return promises, direct payment, C2C, or instant transfer language.
- [x] Exchange source display uses exchange labels, not regions.
- [x] OKX/Binance entries are external invite links only.
- [x] Social spread cards include Telegram, X, Binance Square, and OKX Planet.
- [x] Demo data remains clearly marked as demo.
- [x] API adapter shell is present and disabled by default.
- [x] DIAO official sale UI is present as purchase intent only.
- [ ] Enable API adapter after backend endpoints are verified.
- [ ] Verify all API failure states fall back to stable UI.
- [ ] Verify mobile viewport at narrow widths.
- [ ] Verify Telegram Mini App container on iOS and Android.

## Backend Acceptance

- [x] Cloudflare D1 database exists and binding name is `DB`.
- [x] Cloudflare R2 bucket exists and binding name is `LOSS_PROOFS`.
- [ ] Telegram `initData` is verified server-side.
- [x] Screenshot upload validates MIME type and size.
- [x] Screenshot review returns `exchange`, `confidence`, and review status.
- [x] Low-confidence screenshot review returns `pending_review`.
- [x] No C2C, card payment, or Telegram Stars payment flow is enabled.
- [x] No automatic transfer is triggered by frontend requests.
- [x] DIAO sale intent is bound to verified Telegram user identity.
- [x] DIAO sale max 10 packages per wallet is enforced server-side.
- [x] DIAO sale TON receiver, team wallet, and contract addresses are configured and verified.
- [ ] DIAO sale payment confirmation and allocation ledger are implemented before production enablement.

## API Contract

- [x] Frontend contract documented in `docs/api-contract.md`.
- [x] `ExchangeSource` added to frontend business types.
- [x] API adapter shell is present and disabled by default.
- [x] Backend responses match `lib/business-types.ts`.
- [x] Contract mismatch tests or manual verification completed.

## Environment

- [ ] `NEXT_PUBLIC_OKX_INVITE_URL` configured if OKX link should be visible.
- [ ] `NEXT_PUBLIC_BINANCE_INVITE_URL` configured if Binance link should be visible.
- [ ] `NEXT_PUBLIC_OKX_PLANET_URL` configured before OKX Planet spread tasks are promoted.
- [x] `NEXT_PUBLIC_API_BASE_URL` configured after backend deploy, or intentionally left empty for same-origin Cloudflare Pages APIs.
- [x] `NEXT_PUBLIC_USE_API_ADAPTER=true` set only after backend contract verification.
- [ ] `DIAO_SALE_TON_RECEIVER` configured before official sale opens.
- [ ] `DIAO_TEAM_WALLET` configured before round 17/18 release logic is enabled.
- [ ] `DIAO_INITIAL_CIRCULATION_WALLET` configured from final mainnet config.
- [ ] `DIAO_OFFICIAL_RESERVE_WALLET` configured from final mainnet config.
- [ ] `DIAO_TREASURY_WALLET` configured from final mainnet config.
- [ ] `DIAO_EMERGENCY_RESCUE_WALLET` configured from final mainnet config.
- [ ] `DIAO_ADMIN_WALLET` configured from final mainnet config.
- [x] `DIAO_PRICE_ADMIN_WALLET` configured from final mainnet config.
- [x] `DIAO_MINTER_ADDRESS` configured after mainnet deployment.
- [x] `DIAO_VESTING_ADDRESS` configured after mainnet deployment.
- [x] `DIAO_JETTON_WALLET_CODE_HASH` configured after mainnet deployment.
- [x] `DIAO_METADATA_URL` confirmed before mainnet deployment.
- [x] `DIAO_MAINNET_DEPLOYER_WALLET` recorded as a public address only, with no mnemonic or private key committed.
- [ ] DIAO sale backend enforces `58 TON * package_count + 0.1 TON`, per-wallet cap `10`, and global cap `2,000`.
- [x] `TELEGRAM_BOT_TOKEN` configured in server-only environment.
- [ ] `ADMIN_REVIEW_TOKEN` configured in server-only environment before screenshot review operations.
- [ ] `AGNES_AI_BASE_URL`, `AGNES_AI_API_KEY`, `AGNES_AI_VISION_MODEL`, and `AGNES_AI_TASK_VERIFY_MODEL` configured if Agnes AI is used for OCR/review and task verification assistance.
- [x] Cloudflare secrets are not exposed to frontend.

## Verification Commands

Run before acceptance:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

If `pnpm build` fails inside the sandbox with a Turbopack permission error, rerun in the approved non-sandbox environment.

## Release Criteria

- [ ] All verification commands pass after dependencies are restored.
- [x] Local preview opens and remains available.
- [ ] No production-visible copy implies guaranteed returns, direct payment, instant settlement, or custody.
- [ ] Telegram Mini App launch path works with verified backend identity.
- [x] Backend resources can be recreated from documented configuration.
