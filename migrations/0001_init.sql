-- 1. users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_id TEXT UNIQUE,
  telegram_username TEXT,
  telegram_first_name TEXT,
  telegram_last_name TEXT,
  photo_url TEXT,
  invite_code TEXT UNIQUE,
  invited_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_invite_code ON users(invite_code);

-- 2. sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  telegram_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT
);

-- 3. loss_claims table
CREATE TABLE IF NOT EXISTS loss_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  r2_object_key TEXT,
  original_file_name TEXT,
  file_mime TEXT,
  file_size INTEGER,
  status TEXT NOT NULL, -- not_submitted / pending_review / verified / rejected / demo_estimate
  amount_usd INTEGER, -- stored in cents
  certificate_no TEXT,
  ocr_text TEXT,
  source TEXT NOT NULL, -- api / demo
  exchange TEXT, -- derived exchange name
  exchange_confidence REAL,
  amount_confidence REAL,
  ocr_provider TEXT,
  review_status_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_loss_claims_user_id ON loss_claims(user_id);

-- 4. wallet_balances table
CREATE TABLE IF NOT EXISTS wallet_balances (
  user_id TEXT PRIMARY KEY,
  locked_g_balance INTEGER NOT NULL DEFAULT 0,
  unlocked_g_balance INTEGER NOT NULL DEFAULT 0,
  total_deposited_usdt INTEGER NOT NULL DEFAULT 0, -- stored in cents
  streak_days INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- 5. deposit_events table
CREATE TABLE IF NOT EXISTS deposit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  usdt_amount INTEGER NOT NULL, -- stored in cents
  g_price_usd REAL NOT NULL,
  base_g_amount INTEGER NOT NULL,
  gained_g_amount INTEGER NOT NULL,
  multiplier REAL NOT NULL DEFAULT 1,
  crit INTEGER NOT NULL DEFAULT 0, -- 0/1 boolean representation
  status TEXT NOT NULL, -- demo_recorded / pending_settlement / settled / rejected
  source TEXT NOT NULL, -- api / demo
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deposit_events_user_id ON deposit_events(user_id);

-- 6. withdraw_requests table
CREATE TABLE IF NOT EXISTS withdraw_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  unlocked_g_amount INTEGER NOT NULL,
  status TEXT NOT NULL, -- unavailable / requested / approved / rejected / paid
  destination_type TEXT,
  destination_address TEXT,
  message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_withdraw_requests_user_id ON withdraw_requests(user_id);

-- 7. teams table
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT,
  created_at TEXT NOT NULL
);

-- 8. team_members table
CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL, -- father / pup
  progress REAL NOT NULL DEFAULT 0,
  lit INTEGER NOT NULL DEFAULT 0, -- 0/1 boolean representation
  joined_at TEXT NOT NULL,
  PRIMARY KEY(team_id, user_id)
);

-- 9. badges table
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL, -- 普通 / 稀有 / 传说
  description TEXT,
  rule_key TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

-- 10. user_badges table
CREATE TABLE IF NOT EXISTS user_badges (
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TEXT NOT NULL,
  PRIMARY KEY(user_id, badge_id)
);

-- 11. leaderboard_snapshots table
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL, -- loss / speed
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 12. invites table
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  inviter_user_id TEXT NOT NULL,
  invitee_user_id TEXT,
  invite_code TEXT NOT NULL,
  status TEXT NOT NULL, -- pending / verified
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invites_inviter_user_id ON invites(inviter_user_id);
CREATE INDEX IF NOT EXISTS idx_invites_invite_code ON invites(invite_code);

-- 13. app_config table
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
