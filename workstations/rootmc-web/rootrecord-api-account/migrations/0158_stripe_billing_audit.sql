-- Audit rows for Stripe dispute / refund revoke + restore (support).
CREATE TABLE IF NOT EXISTS stripe_billing_audit (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_object_id TEXT,
  email TEXT,
  account_id TEXT,
  action TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stripe_billing_audit_object
  ON stripe_billing_audit(stripe_object_id);
CREATE INDEX IF NOT EXISTS idx_stripe_billing_audit_email
  ON stripe_billing_audit(email);
