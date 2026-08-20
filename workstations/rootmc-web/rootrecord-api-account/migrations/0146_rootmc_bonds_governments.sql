-- RootMC bonds: town/nation bank participants (auto bond accounts)

CREATE TABLE IF NOT EXISTS rootmc_bonds_government_stats (
  server_id TEXT NOT NULL,
  account_uuid TEXT NOT NULL,
  account_name TEXT NOT NULL,
  kind TEXT NOT NULL,
  display_name TEXT NOT NULL,
  principal_g REAL NOT NULL DEFAULT 0,
  lifetime_earned_g REAL NOT NULL DEFAULT 0,
  weight_pct REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (server_id, account_uuid)
);

CREATE INDEX IF NOT EXISTS idx_rootmc_bonds_gov_principal ON rootmc_bonds_government_stats (server_id, principal_g DESC);
