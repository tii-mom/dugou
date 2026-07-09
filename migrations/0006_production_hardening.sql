-- Migration Version 0006 - Production Hardening
-- Adds database-level guards for purchase-intent concurrency and duplicate claim/purchase confirmations.

-- Prevent concurrent active purchase intents for the same wallet.
-- Confirmed/failed/expired/cancelled records are excluded so a wallet can make later valid purchases.
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_diao_sale_intents_wallet
ON diao_sale_intents(wallet_address)
WHERE status IN ('pending_wallet_signature', 'broadcasted', 'pending_chain_confirmation');

-- Prevent concurrent active purchase intents for the same Telegram user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_diao_sale_intents_user
ON diao_sale_intents(user_id)
WHERE status IN ('pending_wallet_signature', 'broadcasted', 'pending_chain_confirmation');

-- A confirmed chain transaction should map to exactly one claim.
CREATE UNIQUE INDEX IF NOT EXISTS idx_confirmed_diao_claims_tx
ON diao_claims(chain_tx_hash)
WHERE chain_tx_hash IS NOT NULL AND status = 'confirmed';

-- Ledger-friendly integer amount mirrors. These are nullable to keep the migration backward-compatible.
ALTER TABLE diao_sale_intents ADD COLUMN total_ton_nano TEXT;
ALTER TABLE diao_purchases ADD COLUMN paid_ton_nano TEXT;
