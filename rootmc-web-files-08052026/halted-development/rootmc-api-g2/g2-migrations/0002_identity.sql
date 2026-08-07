-- Gen 2 identity: accounts, Minecraft link, Discord OAuth (condensed; no Gen 1 replay).

ALTER TABLE g2_realm ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS g2_license_account (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS g2_user_account (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  account_id TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  pro_unlocked INTEGER NOT NULL DEFAULT 0,
  life_member INTEGER NOT NULL DEFAULT 0,
  extra_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_g2_user_account_account_id ON g2_user_account(account_id);

CREATE TABLE IF NOT EXISTS g2_minecraft_link (
  minecraft_uuid TEXT PRIMARY KEY,
  minecraft_username TEXT NOT NULL,
  account_id TEXT NOT NULL,
  email TEXT,
  verified_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_g2_minecraft_link_account ON g2_minecraft_link(account_id);

CREATE TABLE IF NOT EXISTS g2_link_code (
  code TEXT PRIMARY KEY,
  minecraft_uuid TEXT NOT NULL,
  minecraft_username TEXT NOT NULL,
  realm_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  consumed_at_ms INTEGER,
  account_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_g2_link_code_uuid ON g2_link_code(minecraft_uuid);

CREATE TABLE IF NOT EXISTS g2_discord_link (
  account_id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL UNIQUE,
  discord_username TEXT,
  discord_global_name TEXT,
  discord_email TEXT,
  linked_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS g2_discord_oauth_state (
  state TEXT PRIMARY KEY,
  link_code TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  code_verifier TEXT
);

CREATE TABLE IF NOT EXISTS g2_player_profile (
  account_id TEXT PRIMARY KEY,
  minecraft_uuid TEXT,
  minecraft_username TEXT,
  public_profile INTEGER NOT NULL DEFAULT 1,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS g2_gold_transfer (
  id TEXT PRIMARY KEY,
  realm_id TEXT NOT NULL,
  to_uuid TEXT NOT NULL,
  to_username TEXT,
  amount_g REAL NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  details_json TEXT,
  created_at_ms INTEGER NOT NULL,
  applied_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_g2_gold_transfer_pending
  ON g2_gold_transfer(realm_id, status, to_uuid);
