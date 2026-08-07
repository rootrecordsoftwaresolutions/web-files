-- Gen 2 daily/weekly report storage (markdown only — no Gen 1 prompt/response JSON spam).

CREATE TABLE IF NOT EXISTS g2_report_day (
  realm_id TEXT NOT NULL,
  day_key TEXT NOT NULL,
  report_kind TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  report_md TEXT NOT NULL,
  discord_message_id TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (realm_id, day_key, report_kind, category)
);

CREATE INDEX IF NOT EXISTS idx_g2_report_day_kind
  ON g2_report_day(realm_id, report_kind, day_key DESC);

CREATE TABLE IF NOT EXISTS g2_roll_activity_day (
  realm_id TEXT NOT NULL,
  day_key TEXT NOT NULL,
  discord_user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL DEFAULT '',
  message_count INTEGER NOT NULL DEFAULT 0,
  reaction_count INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (realm_id, day_key, discord_user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_g2_roll_activity_day_key
  ON g2_roll_activity_day(realm_id, day_key);

