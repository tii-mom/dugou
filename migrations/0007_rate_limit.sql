-- Migration Version 0007 - Rate Limit Table
-- Stores lightweight client request counts per route/window for abuse protection.

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
