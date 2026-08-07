-- Online/offline sessions for dev workstations + game server (uptime + merged dev timetable).
CREATE TABLE IF NOT EXISTS rootmc_host_presence_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_key TEXT NOT NULL,
  host_kind TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  end_reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rootmc_host_presence_session_host_started
  ON rootmc_host_presence_session (host_key, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_rootmc_host_presence_session_open
  ON rootmc_host_presence_session (host_key)
  WHERE ended_at IS NULL;
