-- Daily HST item census snapshots for historical /resources/ charts.
CREATE TABLE IF NOT EXISTS rootmc_item_census_daily_summary (
  server_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  scanned_at INTEGER NOT NULL DEFAULT 0,
  scan_note TEXT,
  distinct_items INTEGER NOT NULL DEFAULT 0,
  gold_mint_peg_g REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (server_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS rootmc_item_census_daily_rows (
  server_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  avg_g REAL,
  mint_peg_g REAL,
  scanned_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (server_id, snapshot_date, item_id)
);

CREATE INDEX IF NOT EXISTS idx_rootmc_item_census_daily_date
  ON rootmc_item_census_daily_rows (server_id, snapshot_date DESC, item_count DESC);

CREATE INDEX IF NOT EXISTS idx_rootmc_item_census_daily_item
  ON rootmc_item_census_daily_rows (server_id, item_id, snapshot_date);

-- Seed the latest census as the first historical day. Hawaii has no DST (UTC-10).
INSERT OR IGNORE INTO rootmc_item_census_daily_summary
  (server_id, snapshot_date, scanned_at, scan_note, distinct_items, gold_mint_peg_g, updated_at)
SELECT server_id,
       date(scanned_at / 1000, 'unixepoch', '-10 hours'),
       scanned_at,
       scan_note,
       distinct_items,
       gold_mint_peg_g,
       updated_at
FROM rootmc_item_census_summary
WHERE scanned_at > 0;

INSERT OR IGNORE INTO rootmc_item_census_daily_rows
  (server_id, snapshot_date, item_id, item_count, avg_g, mint_peg_g, scanned_at)
SELECT r.server_id,
       date(s.scanned_at / 1000, 'unixepoch', '-10 hours'),
       r.item_id,
       r.item_count,
       r.avg_g,
       r.mint_peg_g,
       s.scanned_at
FROM rootmc_item_census_rows r
JOIN rootmc_item_census_summary s ON s.server_id = r.server_id
WHERE s.scanned_at > 0;
