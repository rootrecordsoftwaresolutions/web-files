-- RootMC Server Reserve bonds (synced from root-bonds plugin)

CREATE TABLE IF NOT EXISTS rootmc_bonds (
  server_id TEXT NOT NULL,
  bond_id TEXT NOT NULL,
  owner_uuid TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  principal_g REAL NOT NULL,
  issued_at TEXT NOT NULL,
  redeemed_at TEXT,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (server_id, bond_id)
);

CREATE INDEX IF NOT EXISTS idx_rootmc_bonds_owner ON rootmc_bonds (server_id, owner_uuid);
CREATE INDEX IF NOT EXISTS idx_rootmc_bonds_active ON rootmc_bonds (server_id, redeemed_at);

CREATE TABLE IF NOT EXISTS rootmc_bonds_player_stats (
  server_id TEXT NOT NULL,
  owner_uuid TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  active_bonds INTEGER NOT NULL DEFAULT 0,
  principal_g REAL NOT NULL DEFAULT 0,
  uncollected_g REAL NOT NULL DEFAULT 0,
  lifetime_earned_g REAL NOT NULL DEFAULT 0,
  weight_pct REAL NOT NULL DEFAULT 0,
  avg_24h_g REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (server_id, owner_uuid)
);

CREATE INDEX IF NOT EXISTS idx_rootmc_bonds_player_principal ON rootmc_bonds_player_stats (server_id, principal_g DESC);

CREATE TABLE IF NOT EXISTS rootmc_bonds_daily (
  server_id TEXT NOT NULL,
  mc_day_id INTEGER NOT NULL,
  gross_inflow_g REAL NOT NULL,
  bond_pool_g REAL NOT NULL,
  income_share REAL NOT NULL DEFAULT 0.25,
  total_principal_g REAL NOT NULL,
  active_bonds INTEGER NOT NULL,
  settled_at TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (server_id, mc_day_id)
);

CREATE TABLE IF NOT EXISTS rootmc_bonds_daily_payout (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT NOT NULL,
  mc_day_id INTEGER NOT NULL,
  owner_uuid TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  amount_g REAL NOT NULL,
  weight_pct REAL NOT NULL,
  principal_g REAL NOT NULL,
  settled_at TEXT NOT NULL,
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rootmc_bonds_payout_owner ON rootmc_bonds_daily_payout (server_id, owner_uuid, settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_rootmc_bonds_payout_day ON rootmc_bonds_daily_payout (server_id, mc_day_id);
