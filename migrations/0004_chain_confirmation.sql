-- Migration Version 0004 - Chain Confirmation, Intents, and Claims

-- 1. Upgrade diao_sale_intents table (handling incremental sqlite alter commands)
-- We use ALTER TABLE to add new columns to the existing table.
-- If these columns already exist in some developers' environments, SQLite might throw an error.
-- D1 executes this in a transaction. We list them one by one.
ALTER TABLE diao_sale_intents ADD COLUMN query_id TEXT;
ALTER TABLE diao_sale_intents ADD COLUMN expected_amount_nano TEXT;
ALTER TABLE diao_sale_intents ADD COLUMN tx_boc TEXT;
ALTER TABLE diao_sale_intents ADD COLUMN chain_tx_hash TEXT;
ALTER TABLE diao_sale_intents ADD COLUMN chain_lt TEXT;
ALTER TABLE diao_sale_intents ADD COLUMN confirmed_at TEXT;
ALTER TABLE diao_sale_intents ADD COLUMN error_message TEXT;
ALTER TABLE diao_sale_intents ADD COLUMN expires_at TEXT;

-- Create query_id index
CREATE UNIQUE INDEX IF NOT EXISTS idx_intents_query_id ON diao_sale_intents(query_id);

-- 2. Create diao_claims table for tracking claims process on-chain
CREATE TABLE IF NOT EXISTS diao_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  query_id TEXT UNIQUE NOT NULL,
  requested_round INTEGER NOT NULL,
  confirmed_highest_claimed_round INTEGER NOT NULL DEFAULT 0,
  claimable_diao INTEGER NOT NULL,
  tx_boc TEXT,
  chain_tx_hash TEXT,
  chain_lt TEXT,
  status TEXT NOT NULL, -- pending_wallet_signature / broadcasted / pending_chain_confirmation / confirmed / failed
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_claims_wallet ON diao_claims(wallet_address);
CREATE INDEX IF NOT EXISTS idx_claims_tx ON diao_claims(chain_tx_hash);
CREATE INDEX IF NOT EXISTS idx_claims_status ON diao_claims(status);

-- 3. Create mock_chain_txs table for hermetic local testing
CREATE TABLE IF NOT EXISTS mock_chain_txs (
  hash TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  receiver TEXT NOT NULL,
  amount_nano TEXT NOT NULL,
  opcode INTEGER NOT NULL,
  query_id TEXT NOT NULL,
  package_count INTEGER,
  success INTEGER NOT NULL, -- 1: ok, 0: failed
  lt TEXT NOT NULL
);
