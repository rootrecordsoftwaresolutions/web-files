-- Purchaser / Stripe receipt email (may differ from beneficiary when gifting).
ALTER TABLE rootmc_pro_vouchers ADD COLUMN purchaser_email TEXT;
CREATE INDEX IF NOT EXISTS idx_rootmc_pro_vouchers_purchaser
  ON rootmc_pro_vouchers(purchaser_email);
