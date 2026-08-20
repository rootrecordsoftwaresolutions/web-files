-- Optional public base URL for Root-Webstat cron pull (e.g. http://host:8765).
ALTER TABLE rootstat_servers ADD COLUMN webstat_url TEXT;
