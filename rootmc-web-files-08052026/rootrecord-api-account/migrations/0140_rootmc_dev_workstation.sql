-- Dev workstation heartbeat (local startup script → hourly Discord snapshot).
CREATE TABLE IF NOT EXISTS rootmc_dev_workstation (
  id TEXT PRIMARY KEY NOT NULL DEFAULT 'primary',
  last_seen_at TEXT,
  status_line TEXT,
  updated_at TEXT NOT NULL
);
