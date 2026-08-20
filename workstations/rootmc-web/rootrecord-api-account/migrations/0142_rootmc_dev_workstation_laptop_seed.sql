-- Seed laptop row alongside primary desktop workstation.
INSERT OR IGNORE INTO rootmc_dev_workstation (id, last_seen_at, status_line, updated_at)
VALUES ('laptop', NULL, NULL, datetime('now'));
