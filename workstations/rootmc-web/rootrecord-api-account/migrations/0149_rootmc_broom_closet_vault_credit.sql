-- Ensure Server Reserve vault notes reflect the 75% broom-closet allocation (455.384 G).
INSERT INTO rootstat_system_account_balances (
  server_id, minecraft_uuid, minecraft_username, account_type, notes_g, synced_at, updated_at
)
SELECT
  'rootmc',
  'a73f39b0-1b7c-2930-b4a3-ce101812d926',
  'towny-server',
  'reserve',
  455.384,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE EXISTS (
  SELECT 1 FROM rootmc_treasury_ledger
  WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_missing_notes_2026_07_11'
)
AND NOT EXISTS (
  SELECT 1 FROM rootstat_system_account_balances
  WHERE server_id = 'rootmc'
    AND LOWER(minecraft_uuid) = 'a73f39b0-1b7c-2930-b4a3-ce101812d926'
)
AND NOT EXISTS (
  SELECT 1 FROM rootmc_treasury_ledger
  WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_vault_credit_2026_07_11'
);

UPDATE rootstat_system_account_balances
SET notes_g = notes_g + 455.384,
    synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE server_id = 'rootmc'
  AND LOWER(minecraft_uuid) = 'a73f39b0-1b7c-2930-b4a3-ce101812d926'
  AND EXISTS (
    SELECT 1 FROM rootmc_treasury_ledger
    WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_missing_notes_2026_07_11'
  )
  AND NOT EXISTS (
    SELECT 1 FROM rootmc_treasury_ledger
    WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_vault_credit_2026_07_11'
  );

INSERT INTO rootmc_treasury_ledger (
  server_id, mysql_id, entry_type, amount, from_uuid, to_uuid, details, created_at, synced_at
)
SELECT
  'rootmc',
  COALESCE(MAX(mysql_id), 0) + 1,
  'OPENING',
  0.001,
  NULL,
  'a73f39b0-1b7c-2930-b4a3-ce101812d926',
  'executive:broom_closet_vault_credit_2026_07_11',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM rootmc_treasury_ledger
WHERE server_id = 'rootmc'
  AND NOT EXISTS (
    SELECT 1 FROM rootmc_treasury_ledger
    WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_vault_credit_2026_07_11'
  );
