-- Paid one-month Pro window (separate from weekly award pro_redeemed_until).
ALTER TABLE user_accounts ADD COLUMN pro_paid_until TEXT;
