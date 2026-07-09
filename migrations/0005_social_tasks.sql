-- Migration Version 0005 - Social Tasks

CREATE TABLE IF NOT EXISTS social_task_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  task_type TEXT NOT NULL,
  submitted_url TEXT NOT NULL,
  submitted_url_normalized TEXT NOT NULL,
  platform_post_id TEXT,
  fetched_title TEXT,
  fetched_text TEXT,
  fetched_screenshot_key TEXT,
  fetch_status TEXT NOT NULL, -- success, failed
  fetch_error TEXT,
  hard_rule_status TEXT NOT NULL, -- pass, fail
  hard_rule_reason TEXT,
  ai_provider TEXT,
  ai_model TEXT,
  ai_result_json TEXT,
  ai_suggested_status TEXT, -- ai_passed, rejected, pending_review
  status TEXT NOT NULL, -- pending_review, verified, rejected
  review_status_reason TEXT,
  reward_status TEXT NOT NULL DEFAULT 'not_issued',
  reviewed_at TEXT,
  reviewed_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_social_task_submissions_user_id ON social_task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_social_task_submissions_status ON social_task_submissions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_task_submissions_user_url ON social_task_submissions(user_id, submitted_url_normalized);
