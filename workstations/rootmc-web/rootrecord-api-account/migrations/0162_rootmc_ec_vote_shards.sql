-- Vote Shard weight held in each player's double /ec (per server_id).
-- Plugin heartbeat syncs this; governance raw = SUM(weight) × Pro (no playtime).
CREATE TABLE IF NOT EXISTS rootmc_ec_vote_shards (
  minecraft_uuid TEXT NOT NULL,
  server_id TEXT NOT NULL DEFAULT 'rootmc',
  weight INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (minecraft_uuid, server_id)
);

CREATE INDEX IF NOT EXISTS idx_rootmc_ec_vote_shards_uuid
  ON rootmc_ec_vote_shards (minecraft_uuid);
