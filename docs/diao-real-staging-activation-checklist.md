# DIAO Staging Activation Checklist

This checklist defines the steps required to safely activate, operate, and verify the DIAO backend on a controlled **Staging** environment.

---

## 1. Environment Configuration Checklist
Ensure the following variables are configured in the Cloudflare Pages/Workers environment:

- [ ] **D1 DB Binding**: Target D1 database instance bound to `DB`.
- [ ] **R2 LOSS_PROOFS Binding**: Target R2 bucket instance bound to `LOSS_PROOFS`.
- [ ] **SESSION_SECRET**: Secure random string for session signing.
- [ ] **ADMIN_REVIEW_TOKEN**: Admin token for loss claims and social task reviews.
- [ ] **TELEGRAM_BOT_TOKEN**: Bot token for Telegram Login authentication.
- [ ] **AGNES_AI_API_KEY**: API key for Agnes AI screenshot verification.
- [ ] **TONCENTER_API_KEY** / **TON_API_KEY**: TON RPC access credentials.
- [ ] **CHAIN_INDEXER_MODE**: Set to `testnet` or `mainnet` (do NOT set to `mock` on Staging).

---

## 2. Database Migrations Execution
Apply D1 migrations in sequential order. Check that all migration files are executed:

- [ ] `0001_init.sql`
- [ ] `0002_diao_sale.sql`
- [ ] `0003_purchase_ledger.sql`
- [ ] `0004_chain_confirmation.sql`
- [ ] `0005_social_tasks.sql`
- [ ] `0006_production_hardening.sql`
- [ ] `0007_rate_limit.sql`

Execution Command:
```bash
pnpm db:migrate:remote
```

---

## 3. Real Chain Integration Verification

- [ ] **Read-Only Smoke Test**: Run the real-chain verification script:
  ```bash
  pnpm verify:real-chain:readonly
  ```
  Ensure it parses contract addresses and returns vesting state successfully.

> [!NOTE]
> `verify:real-chain:readonly` is strictly read-only. It does not use private keys or mnemonics and does not sign or broadcast mainnet mutations.

- [ ] **Integration Tests on Staging**:
  Staging verification supports testing in both mock mode (`CHAIN_INDEXER_MODE=mock`) and read-only real mode. Ensure the test suite runs correctly.

---

## 4. Launch Governance

### Environment Status
* **Staging**: **Allowed (内测允许)**
* **Production**: **Blocked (正式上线阻断)**

### Production Blockers
1. **TON Async Bounce Recovery**: Missing transaction rollback on bounce events for vesting controller and jetton minter is a critical blocker. A contract-level audit or redesign is required.
2. **Secret Rotation Checklist**: Production secrets must be rotated and verified before the official launch.
3. **Real Chain Read-Only Smoke Test**: Mainnet addresses must be checked and confirmed valid on staging before launch.
4. **Mainnet Transaction Warning**: No mainnet transactions or mutation operations should be executed during staging verification.

---

## 5. Rollback and Contingency Plans

- **API Routes Failure**:
  If routes return HTTP 500 or throw exceptions during staging activation, roll back the Cloudflare Pages deployment to the previous stable release hash.
- **D1 Database Migrations**:
  If migrations fail or throw database errors, do NOT manually drop columns or tables. Run `wrangler d1` commands to check the migrations state table and fix specific syntax issues.
- **Rate Limiting Errors**:
  If legitimate user requests are incorrectly rate limited (exceeding threshold), check D1 logs or run pruning queries:
  ```sql
  DELETE FROM diao_rate_limits WHERE route = '/api/auth/telegram';
  ```
