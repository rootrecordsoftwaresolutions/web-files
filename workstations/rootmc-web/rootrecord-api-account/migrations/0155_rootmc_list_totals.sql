-- Precomputed economy list totals for /list (Claims / Towny / official / global).
-- Written by host MySQL sync + Worker rollups; public GET reads only.

CREATE TABLE IF NOT EXISTS rootmc_list_totals (
  scope TEXT NOT NULL,
  group_key TEXT NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  amount_g REAL NOT NULL DEFAULT 0,
  meta_json TEXT,
  computed_at TEXT NOT NULL,
  source_server_id TEXT,
  PRIMARY KEY (scope, group_key, category)
);

CREATE INDEX IF NOT EXISTS idx_rootmc_list_totals_scope
  ON rootmc_list_totals (scope, group_key);

CREATE TABLE IF NOT EXISTS rootmc_list_fetch_cache (
  cache_key TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
