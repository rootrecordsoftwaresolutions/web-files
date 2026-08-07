-- Gen1 ↔ Gen2 server presence (online/offline heartbeats). Hub: api2 D1.

CREATE TABLE IF NOT EXISTS g2_cross_presence (
  tag TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'offline',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
