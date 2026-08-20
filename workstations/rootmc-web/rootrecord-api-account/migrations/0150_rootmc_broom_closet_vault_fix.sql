-- Correct doubled Server Reserve vault credit from 0148 + 0149 overlap.
UPDATE rootstat_system_account_balances
SET notes_g = 455.384,
    synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE server_id = 'rootmc'
  AND LOWER(minecraft_uuid) = 'a73f39b0-1b7c-2930-b4a3-ce101812d926'
  AND notes_g > 600
  AND EXISTS (
    SELECT 1 FROM rootmc_treasury_ledger
    WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_vault_credit_2026_07_11'
  );
