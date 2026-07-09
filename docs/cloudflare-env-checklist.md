# Cloudflare Environment Checklist

Use this checklist for Cloudflare Pages and Functions configuration. Keep secrets in Cloudflare environment variables or secrets, not in source files.

## Public Variables

These may be exposed to the browser:

- `NEXT_PUBLIC_TELEGRAM_APP_URL`
- `NEXT_PUBLIC_TG_APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_BASE_URL` - leave empty for same-origin Cloudflare Pages deployment.
- `NEXT_PUBLIC_USE_API_ADAPTER` - set `true` only after Cloudflare API checks pass.
- `NEXT_PUBLIC_OKX_INVITE_URL`
- `NEXT_PUBLIC_BINANCE_INVITE_URL`
- `NEXT_PUBLIC_OKX_PLANET_URL`
- `NEXT_PUBLIC_DIAO_TOKEN_SYMBOL`
- `NEXT_PUBLIC_DIAO_SALE_ENABLED` - keep `false` until mainnet contract and backend chain sync are verified.

## Server-Only Variables

These must not use the `NEXT_PUBLIC_` prefix:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_INITDATA_MAX_AGE_SECONDS`
- `ADMIN_REVIEW_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `CLOUDFLARE_WORKER_NAME`
- `CLOUDFLARE_D1_DATABASE_NAME`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_R2_BUCKET_NAME`
- `R2_BUCKET_BINDING`
- `R2_PUBLIC_BASE_URL`
- `OCR_PROVIDER`
- `CLOUDFLARE_AI_BINDING`
- `CLOUDFLARE_AI_MODEL`
- `CLOUDFLARE_AI_GATEWAY_URL`
- `AGNES_AI_BASE_URL`
- `AGNES_AI_API_KEY`
- `AGNES_AI_MODEL`
- `AGNES_AI_VISION_MODEL`
- `AGNES_AI_TASK_VERIFY_MODEL`
- `DIAO_TOKEN_CHAIN`
- `DIAO_TOKEN_ADDRESS`
- `DIAO_MINTER_ADDRESS`
- `DIAO_VESTING_ADDRESS`
- `DIAO_JETTON_WALLET_CODE_HASH`
- `DIAO_METADATA_URL`
- `DIAO_MAINNET_DEPLOYER_WALLET`
- `DIAO_INITIAL_CIRCULATION_WALLET`
- `DIAO_OFFICIAL_RESERVE_WALLET`
- `DIAO_TREASURY_WALLET`
- `DIAO_EMERGENCY_RESCUE_WALLET`
- `DIAO_ADMIN_WALLET`
- `DIAO_PRICE_ADMIN_WALLET`
- `DIAO_SALE_TON_RECEIVER`
- `DIAO_TEAM_WALLET`
- `DIAO_SALE_MAX_PACKAGES_PER_WALLET`
- `DIAO_SALE_MAX_PACKAGES_TOTAL`
- `DIAO_SALE_CONTRACT_GAS_BUFFER_TON`
- `PRICE_PROVIDER`
- `PRICE_PROVIDER_API_KEY`
- `SESSION_SECRET`
- `ADMIN_REVIEW_TOKEN`
- `AGNES_AI_API_KEY`

## Bindings

Configured in `wrangler.toml`:

- D1 binding: `DB`
- R2 binding: `LOSS_PROOFS`
- Workers AI binding: `AI`

## Must Not Be Committed

- Telegram bot token
- Cloudflare API token
- RPC API keys
- `SESSION_SECRET`
- `ADMIN_REVIEW_TOKEN`
- `AGNES_AI_API_KEY`
- TON deployer mnemonic
- Wallet mnemonic
- Private keys
- Seed phrases

## Pre-Launch Checks

- `NEXT_PUBLIC_DIAO_SALE_ENABLED=false` until contract deployment and backend ledger sync pass.
- `DIAO_MINTER_ADDRESS` and `DIAO_VESTING_ADDRESS` match the mainnet deployment transaction output.
- `DIAO_METADATA_URL` matches the final metadata JSON.
- `DIAO_MAINNET_DEPLOYER_WALLET` is a public address only.
- Official role wallets match `contracts/wrappers/config.ts` and are stored without any private key or mnemonic.
- Token sale backend validates `58 TON * package_count + 0.1 TON`, single-wallet cap `10`, and global cap `2,000`.
- `/api/health` returns `db`, `r2`, `ai`, and `status` as `ok`.
- `pnpm lint`, `pnpm typecheck`, Cloudflare build, and backend verify script pass in an environment with dependencies installed.
