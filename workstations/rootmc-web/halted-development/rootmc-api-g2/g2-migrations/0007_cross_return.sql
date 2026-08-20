-- Players evacuated during a gen restart; holding gen sends them home when home_tag is online.

CREATE TABLE IF NOT EXISTS g2_cross_return (
  player_uuid TEXT PRIMARY KEY,
  username TEXT NOT NULL DEFAULT '',
  home_tag TEXT NOT NULL,
  holding_tag TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_g2_cross_return_holding_home
  ON g2_cross_return (holding_tag, home_tag);
