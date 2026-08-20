-- In-game /feedback inbox — Ava taps this official list (Slack still gets a copy for staff).
CREATE TABLE IF NOT EXISTS rootmc_ingame_feedback (
  id TEXT PRIMARY KEY,
  minecraft_uuid TEXT NOT NULL,
  minecraft_username TEXT NOT NULL,
  server_id TEXT,
  server_name TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  ava_note TEXT,
  error_detail TEXT,
  claimed_at TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rootmc_ingame_feedback_status_created
  ON rootmc_ingame_feedback (status, created_at);
