-- Gen 2 D1 core — fresh schema (do not replay Gen 1 MANIFEST).

CREATE TABLE IF NOT EXISTS g2_realm (
  realm_id TEXT PRIMARY KEY,
  realm_name TEXT NOT NULL,
  server_address TEXT,
  map_url TEXT,
  game_version TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  last_heartbeat_ms INTEGER,
  last_economy_snapshot_ms INTEGER
);

CREATE TABLE IF NOT EXISTS g2_realm_credentials (
  realm_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY (realm_id) REFERENCES g2_realm(realm_id)
);

CREATE TABLE IF NOT EXISTS g2_snap_balance (
  realm_id TEXT NOT NULL,
  player_uuid TEXT NOT NULL,
  gold_g REAL NOT NULL DEFAULT 0,
  username TEXT,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (realm_id, player_uuid)
);

CREATE TABLE IF NOT EXISTS g2_snap_net_worth (
  realm_id TEXT NOT NULL,
  player_uuid TEXT NOT NULL,
  net_worth_g REAL NOT NULL DEFAULT 0,
  wallet_g REAL NOT NULL DEFAULT 0,
  items_g REAL NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (realm_id, player_uuid)
);

CREATE TABLE IF NOT EXISTS g2_snap_shop (
  realm_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  seller_uuid TEXT,
  item_key TEXT NOT NULL,
  price_g REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  world TEXT,
  x INTEGER,
  y INTEGER,
  z INTEGER,
  listing_type TEXT,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (realm_id, listing_id)
);

CREATE TABLE IF NOT EXISTS g2_snap_item_market (
  realm_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  median_g REAL NOT NULL DEFAULT 0,
  sample_n INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (realm_id, item_key)
);

CREATE TABLE IF NOT EXISTS g2_snap_treasury (
  realm_id TEXT PRIMARY KEY,
  reserve_g REAL NOT NULL DEFAULT 0,
  supply_json TEXT,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS g2_snap_playtime (
  realm_id TEXT NOT NULL,
  player_uuid TEXT NOT NULL,
  total_sec INTEGER NOT NULL DEFAULT 0,
  month_key TEXT,
  month_sec INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (realm_id, player_uuid)
);

CREATE TABLE IF NOT EXISTS g2_snap_online (
  realm_id TEXT PRIMARY KEY,
  player_count INTEGER NOT NULL DEFAULT 0,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS g2_snap_bonds (
  realm_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_g2_snap_balance_realm ON g2_snap_balance(realm_id);
CREATE INDEX IF NOT EXISTS idx_g2_snap_shop_realm ON g2_snap_shop(realm_id);
CREATE INDEX IF NOT EXISTS idx_g2_snap_item_market_realm ON g2_snap_item_market(realm_id);
