-- Ensure the timeout cron posts only once per workstation session.
ALTER TABLE rootmc_dev_workstation ADD COLUMN timeout_notified_at TEXT;
