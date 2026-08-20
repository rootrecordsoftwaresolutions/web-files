-- In-game /proposal queue — Ava alone formalizes into rootmc_legislation_items (PROP).
CREATE TABLE IF NOT EXISTS rootmc_proposal_ideas (
  id TEXT PRIMARY KEY,
  minecraft_uuid TEXT NOT NULL,
  minecraft_username TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  raw_message TEXT NOT NULL,
  fee_g INTEGER NOT NULL DEFAULT 64,
  status TEXT NOT NULL DEFAULT 'queued',
  legislation_item_id TEXT,
  ava_title TEXT,
  ava_description TEXT,
  category TEXT,
  error_detail TEXT,
  claimed_at TEXT,
  formalized_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rootmc_proposal_ideas_status_created
  ON rootmc_proposal_ideas (status, created_at);
