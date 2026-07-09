# DIAO Staging Readiness V2 Safeguards Report

This report outlines the implementations for DIAO Staging Readiness V2, including Rate Limit V1 protection, Real Chain Read-only Smoke Test validation script, and current launch decisions.

## 1. Rate Limit V1 Implementation

To protect the server from endpoint abuse and DDoS attacks, we implemented a lightweight D1 database-backed rate limiter (`lib/rate-limit.ts`).

### Schema Definition (0007_rate_limit.sql)
```sql
CREATE TABLE IF NOT EXISTS diao_rate_limits (
  key TEXT NOT NULL,
  route TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (key, route, window_start)
);
CREATE INDEX IF NOT EXISTS idx_diao_rate_limits_updated_at
ON diao_rate_limits(updated_at);
```

### Rate Limiter Behavior
1. **Key Resolution Order**: Session User ID -> Wallet Address -> Telegram User ID -> Client IP -> 'anonymous'.
2. **Window Size**: 60 seconds (1 minute).
3. **Route Thresholds**:
   - `/api/auth/telegram`: 10/min
   - `/api/token-sale/intent`: 10/min
   - `/api/purchases/confirm`: 20/min
   - `/api/claims/intent`: 10/min
   - `/api/claims/confirm`: 20/min
   - `/api/loss-proofs/upload`: 10/min
   - `/api/loss-proofs/submit`: 10/min
   - `/api/social-tasks/submit`: 20/min
   - `/api/admin/*`: 30/min
4. **Behavior on Failure**:
   - **Production / Staging**: Fail-closed (returns HTTP 429 if D1 query fails or DB binding is missing).
   - **Local Dev**: Fail-open (allows requests to proceed if DB is not present to prevent blocking local development).

### Operations and Maintenance SQL Examples
Admin / DevOps can monitor and clean the rate limit table with the following SQL queries:
```sql
-- 1. View request counts grouped by route to audit traffic
SELECT route, COUNT(*) AS windows, SUM(request_count) AS total_requests
FROM diao_rate_limits
GROUP BY route
ORDER BY total_requests DESC;

-- 2. Prune old rate limit history older than 7 days
DELETE FROM diao_rate_limits
WHERE updated_at < datetime('now', '-7 days');
```

---

## 2. Real Chain Read-Only Smoke Test

We created a secure, read-only validation script (`scripts/verify-real-chain-readonly.cjs`) to fetch real chain vesting and minter configurations.

### Usage
```bash
pnpm verify:real-chain:readonly
```

### Environment Variables
Configure the following variables in the environment to check status against a real chain:
```bash
CHAIN_INDEXER_MODE=real
DIAO_VESTING_ADDRESS=EQ...               # Vesting contract address
DIAO_JETTON_MINTER_ADDRESS=EQ...        # Jetton Minter contract address
TONCENTER_API_KEY=xxx...                 # (Recommended) API key for toncenter
TON_API_KEY=xxx...                       # (Fallback) API key for toncenter if TONCENTER_API_KEY is not defined
REAL_CHAIN_TEST_WALLET=EQ...             # (Optional) Test user wallet address to check packages
```

### Design & Security Constraints
1. **Read-Only**: It only runs `get` methods. It does not construct or send mutating transactions.
2. **Private-Key Free**: No private keys or mnemonics are used.
3. **No Wallet Signature**: Uses plain public queries.
4. **Mock Refusal**: Refuses to run if `CHAIN_INDEXER_MODE=mock` (exits with non-zero exit code).
5. **No Secrets Output**: Safely redacts credentials from logs and outputs the source of API key (`TONCENTER_API_KEY` or `TON_API_KEY`).
6. **No API Key Graceful Fallback**: If no API key is provided, the script will proceed in rate-limited public mode but outputs warning logs about potential rate limits.

---

## 3. Staging Execution Steps

1. Configure required staging environment variables (DB binding, Telegram keys, etc.).
2. Apply migrations to staging D1 instance:
   ```bash
   pnpm db:migrate:remote
   ```
3. Verify basic route behavior and run integration tests.
4. Set `CHAIN_INDEXER_MODE=mainnet` (or `testnet`) and run the read-only smoke test:
   ```bash
   pnpm verify:real-chain:readonly
   ```

---

## 4. Production Launch Status & Blockers

### Current Launch Judgment
- **Staging**: **Allowed** (Safe for testing under controlled environments).
- **Production**: **Blocked** (Do NOT deploy to production/mainnet).

### Production Blockers
1. **TON Async Bounce Recovery**: Missing transaction rollback on bounce events for vesting controller and jetton minter is a critical blocker. A contract-level audit or redesign is required.
2. **Secret Rotation Checklist**: Production secrets must be rotated and verified before the official launch.
3. **Real Chain Read-Only Smoke Test**: Mainnet addresses must be checked and confirmed valid on staging before launch.
4. **Mainnet Transaction Warning**: No mainnet transactions or mutation operations should be executed during staging verification.
