-- Migration Version 0003 - DIAO Token Sale Ledger and Purchase Records

CREATE TABLE IF NOT EXISTS diao_purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT UNIQUE NOT NULL,
  package_count INTEGER NOT NULL,
  paid_ton REAL NOT NULL,
  immediate_diao INTEGER NOT NULL,
  locked_diao INTEGER NOT NULL,
  total_diao INTEGER NOT NULL,
  highest_claimed_round INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL, -- confirmed / failed
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_user ON diao_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_wallet ON diao_purchases(wallet_address);
CREATE INDEX IF NOT EXISTS idx_purchases_tx ON diao_purchases(tx_hash);
