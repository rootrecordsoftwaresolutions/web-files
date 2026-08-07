-- Single Discord message that lists automated reports and last-run versions.

CREATE TABLE IF NOT EXISTS rootmc_automated_reports_board (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
