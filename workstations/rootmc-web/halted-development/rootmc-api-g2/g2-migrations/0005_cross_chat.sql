-- Cross-server in-game chat relay (Gen1 ↔ Gen2). Hub: api2 D1.

CREATE TABLE IF NOT EXISTS g2_cross_chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag TEXT NOT NULL,
  username TEXT NOT NULL,
  player_uuid TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_g2_cross_chat_id ON g2_cross_chat (id DESC);
