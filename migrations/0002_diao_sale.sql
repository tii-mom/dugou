-- Migration Version 0002 - DIAO Token Sale
-- NOTE: The ALTER TABLE command adding "expires_at" below is not fully idempotent in basic SQLite.
-- In production Cloudflare D1 environment, wrangler applies migrations exactly once, which handles this safely.
-- For local re-runs, if SQLite warns that the column already exists, this step can be safely ignored.

-- Create diao_sale_intents table
CREATE TABLE IF NOT EXISTS diao_sale_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  packages INTEGER NOT NULL,
  total_ton REAL NOT NULL,
  immediate_diao INTEGER NOT NULL,
  locked_diao INTEGER NOT NULL,
  per_round_diao INTEGER NOT NULL,
  status TEXT NOT NULL, -- pending_contract_payment / settled / rejected / cancelled
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_diao_sale_intents_user_id ON diao_sale_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_diao_sale_intents_wallet_address ON diao_sale_intents(wallet_address);

-- Add expires_at column to loss_claims table
ALTER TABLE loss_claims ADD COLUMN expires_at TEXT;
