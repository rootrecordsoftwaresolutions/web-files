-- Current MC-day bond inflow (not yet settled) — synced from root-bonds plugin.

CREATE TABLE IF NOT EXISTS rootmc_bonds_live_state (
  server_id TEXT PRIMARY KEY,
  current_mc_day_id INTEGER NOT NULL DEFAULT 0,
  pending_gross_inflow_g REAL NOT NULL DEFAULT 0,
  pending_estimated_pool_g REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL
);
