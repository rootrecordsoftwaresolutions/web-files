-- Developer portal: free account keys for Root-Core license.yml + server linking.

CREATE TABLE IF NOT EXISTS rootmc_developer_account_keys (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_last4 TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_rootmc_developer_account_keys_account
  ON rootmc_developer_account_keys (account_id, created_at);

-- Optional bind: which product/account key was used when registering a server.
ALTER TABLE rootstat_servers ADD COLUMN product_key_id TEXT;
