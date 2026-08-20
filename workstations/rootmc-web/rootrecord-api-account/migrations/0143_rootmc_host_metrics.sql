-- Per-host minute rollups (CPU/RAM/disk; server may include TPS).
CREATE TABLE IF NOT EXISTS rootmc_host_metrics_minute (
  host_key TEXT NOT NULL,
  host_kind TEXT NOT NULL,
  host_label TEXT NOT NULL,
  minute_ts TEXT NOT NULL,
  cpu_avg_pct REAL NOT NULL,
  ram_avg_pct REAL NOT NULL,
  disk_used_pct REAL NOT NULL,
  tps_avg REAL,
  sample_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (host_key, minute_ts)
);

CREATE INDEX IF NOT EXISTS idx_rootmc_host_metrics_minute_ts
  ON rootmc_host_metrics_minute (minute_ts DESC);

-- Running totals for all-time averages (updated on each minute ingest).
CREATE TABLE IF NOT EXISTS rootmc_host_metrics_lifetime (
  host_key TEXT PRIMARY KEY,
  host_kind TEXT NOT NULL,
  host_label TEXT NOT NULL,
  cpu_sum REAL NOT NULL DEFAULT 0,
  ram_sum REAL NOT NULL DEFAULT 0,
  disk_sum REAL NOT NULL DEFAULT 0,
  tps_sum REAL NOT NULL DEFAULT 0,
  sample_total INTEGER NOT NULL DEFAULT 0,
  minute_count INTEGER NOT NULL DEFAULT 0,
  first_minute_ts TEXT,
  last_minute_ts TEXT,
  updated_at TEXT NOT NULL
);
