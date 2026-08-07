-- Tradeable Pro vouchers (Stripe one-time → vault → redeem).
CREATE TABLE IF NOT EXISTS rootmc_pro_vouchers (
  id TEXT PRIMARY KEY,
  tier TEXT NOT NULL,
  account_id TEXT NOT NULL,
  email TEXT,
  minecraft_uuid TEXT,
  minecraft_username TEXT,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent TEXT,
  stripe_charge_id TEXT,
  vault_order_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending_vault',
  created_at TEXT NOT NULL,
  claimed_at TEXT,
  redeemed_at TEXT,
  voided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_rootmc_pro_vouchers_account
  ON rootmc_pro_vouchers(account_id, status);
CREATE INDEX IF NOT EXISTS idx_rootmc_pro_vouchers_charge
  ON rootmc_pro_vouchers(stripe_charge_id);
CREATE INDEX IF NOT EXISTS idx_rootmc_pro_vouchers_session
  ON rootmc_pro_vouchers(stripe_checkout_session_id);

ALTER TABLE rootmc_vault_orders ADD COLUMN meta_json TEXT;
