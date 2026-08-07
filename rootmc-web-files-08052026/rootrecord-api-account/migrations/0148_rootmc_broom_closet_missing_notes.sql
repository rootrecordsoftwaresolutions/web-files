-- One-time correction: 607.179 G stored /mint gold had no matching circulating notes (broom closet audit).
-- Split: 75% Server Reserve vault (455.384 G net), 25% Gold Backed Bond pool (151.795 G) to holders pro-rata.
-- Idempotent via details / mc_day_id guards.

-- 1) Reserve ledger inflow (full discovery credited before bond pool outflow)
INSERT INTO rootmc_treasury_ledger (
  server_id, mysql_id, entry_type, amount, from_uuid, to_uuid, details, created_at, synced_at
)
SELECT
  'rootmc',
  COALESCE(MAX(mysql_id), 0) + 1,
  'TAX',
  607.179,
  NULL,
  'a73f39b0-1b7c-2930-b4a3-ce101812d926',
  'executive:broom_closet_missing_notes_2026_07_11',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM rootmc_treasury_ledger
WHERE server_id = 'rootmc'
  AND NOT EXISTS (
    SELECT 1 FROM rootmc_treasury_ledger
    WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_missing_notes_2026_07_11'
  );

-- 2) Bond pool outflow (25% of discovery — matches in-game Gold Backed Bond income share)
INSERT INTO rootmc_treasury_ledger (
  server_id, mysql_id, entry_type, amount, from_uuid, to_uuid, details, created_at, synced_at
)
SELECT
  'rootmc',
  COALESCE(MAX(mysql_id), 0) + 1,
  'BOND_COUPON',
  151.795,
  'a73f39b0-1b7c-2930-b4a3-ce101812d926',
  NULL,
  'executive:broom_closet_bond_pool_2026_07_11',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM rootmc_treasury_ledger
WHERE server_id = 'rootmc'
  AND NOT EXISTS (
    SELECT 1 FROM rootmc_treasury_ledger
    WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_bond_pool_2026_07_11'
  );

-- 3) Bond settlement record (special MC day)
INSERT INTO rootmc_bonds_daily (
  server_id, mc_day_id, gross_inflow_g, bond_pool_g, income_share, total_principal_g, active_bonds, settled_at, synced_at
)
SELECT
  'rootmc', 20260711, 607.179, 151.795, 0.25, 2538.344, 5,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (
  SELECT 1 FROM rootmc_bonds_daily WHERE server_id = 'rootmc' AND mc_day_id = 20260711
);

-- 4) Holder payouts (pro-rata by outstanding principal)
INSERT INTO rootmc_bonds_daily_payout (server_id, mc_day_id, owner_uuid, owner_name, amount_g, weight_pct, principal_g, settled_at, synced_at)
SELECT 'rootmc', 20260711, 'c174e9b8-5e12-4f4e-b599-5d1129eb2f3c', 'khouzrh', 15.584, 6.14, 260.597, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (SELECT 1 FROM rootmc_bonds_daily_payout WHERE server_id = 'rootmc' AND mc_day_id = 20260711 AND owner_uuid = 'c174e9b8-5e12-4f4e-b599-5d1129eb2f3c');

INSERT INTO rootmc_bonds_daily_payout (server_id, mc_day_id, owner_uuid, owner_name, amount_g, weight_pct, principal_g, settled_at, synced_at)
SELECT 'rootmc', 20260711, '3e660994-b16c-4714-bc15-9081aa928729', 'Alexrs94', 1.017, 0.67, 17.0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (SELECT 1 FROM rootmc_bonds_daily_payout WHERE server_id = 'rootmc' AND mc_day_id = 20260711 AND owner_uuid = '3e660994-b16c-4714-bc15-9081aa928729');

INSERT INTO rootmc_bonds_daily_payout (server_id, mc_day_id, owner_uuid, owner_name, amount_g, weight_pct, principal_g, settled_at, synced_at)
SELECT 'rootmc', 20260711, 'ff104a2f-a995-4ca0-a869-3c185c098391', 'A_Town', 59.841, 23.57, 1000.679, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (SELECT 1 FROM rootmc_bonds_daily_payout WHERE server_id = 'rootmc' AND mc_day_id = 20260711 AND owner_uuid = 'ff104a2f-a995-4ca0-a869-3c185c098391');

INSERT INTO rootmc_bonds_daily_payout (server_id, mc_day_id, owner_uuid, owner_name, amount_g, weight_pct, principal_g, settled_at, synced_at)
SELECT 'rootmc', 20260711, 'f8c84ea0-49f9-42b1-a034-c8661734b20a', 'Moreni', 40.448, 15.93, 676.379, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (SELECT 1 FROM rootmc_bonds_daily_payout WHERE server_id = 'rootmc' AND mc_day_id = 20260711 AND owner_uuid = 'f8c84ea0-49f9-42b1-a034-c8661734b20a');

INSERT INTO rootmc_bonds_daily_payout (server_id, mc_day_id, owner_uuid, owner_name, amount_g, weight_pct, principal_g, settled_at, synced_at)
SELECT 'rootmc', 20260711, '24140961-3a66-48c3-a297-cd30c772753d', 'Norica', 34.905, 13.79, 583.689, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE NOT EXISTS (SELECT 1 FROM rootmc_bonds_daily_payout WHERE server_id = 'rootmc' AND mc_day_id = 20260711 AND owner_uuid = '24140961-3a66-48c3-a297-cd30c772753d');

-- 5) Circulating note bumps (D1 read model — live MySQL handoff mirrors this)
UPDATE rootstat_player_balances
SET balance = balance + 15.584, synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE server_id = 'rootmc' AND minecraft_uuid = 'c174e9b8-5e12-4f4e-b599-5d1129eb2f3c'
  AND EXISTS (SELECT 1 FROM rootmc_treasury_ledger WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_missing_notes_2026_07_11');

UPDATE rootstat_player_balances
SET balance = balance + 1.017, synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE server_id = 'rootmc' AND minecraft_uuid = '3e660994-b16c-4714-bc15-9081aa928729'
  AND EXISTS (SELECT 1 FROM rootmc_treasury_ledger WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_missing_notes_2026_07_11');

UPDATE rootstat_system_account_balances
SET notes_g = notes_g + 59.841, synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE server_id = 'rootmc' AND minecraft_uuid = 'ff104a2f-a995-4ca0-a869-3c185c098391'
  AND EXISTS (SELECT 1 FROM rootmc_treasury_ledger WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_missing_notes_2026_07_11');

UPDATE rootstat_system_account_balances
SET notes_g = notes_g + 40.448, synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE server_id = 'rootmc' AND minecraft_uuid = 'f8c84ea0-49f9-42b1-a034-c8661734b20a'
  AND EXISTS (SELECT 1 FROM rootmc_treasury_ledger WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_missing_notes_2026_07_11');

UPDATE rootstat_system_account_balances
SET notes_g = notes_g + 34.905, synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE server_id = 'rootmc' AND minecraft_uuid = '24140961-3a66-48c3-a297-cd30c772753d'
  AND EXISTS (SELECT 1 FROM rootmc_treasury_ledger WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_missing_notes_2026_07_11');

UPDATE rootstat_player_balances
SET balance = balance + 455.384, synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE server_id = 'rootmc' AND minecraft_uuid = 'a73f39b0-1b7c-2930-b4a3-ce101812d926'
  AND EXISTS (SELECT 1 FROM rootmc_treasury_ledger WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_missing_notes_2026_07_11');

UPDATE rootmc_treasury_sync_state
SET treasury_balance = COALESCE(treasury_balance, 0) + 455.384,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE server_id = 'rootmc'
  AND EXISTS (SELECT 1 FROM rootmc_treasury_ledger WHERE server_id = 'rootmc' AND details = 'executive:broom_closet_missing_notes_2026_07_11');
