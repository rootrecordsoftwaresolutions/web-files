-- Item census from Root-ItemInfo (/resources/) — same shape as Gen 1 for shared handlers.

CREATE TABLE IF NOT EXISTS rootmc_item_census_summary (
  server_id TEXT PRIMARY KEY NOT NULL,
  scanned_at INTEGER NOT NULL DEFAULT 0,
  scan_note TEXT,
  distinct_items INTEGER NOT NULL DEFAULT 0,
  gold_mint_peg_g REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rootmc_item_census_rows (
  server_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  avg_g REAL,
  mint_peg_g REAL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (server_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_rootmc_item_census_rows_count
  ON rootmc_item_census_rows (server_id, item_count DESC);
