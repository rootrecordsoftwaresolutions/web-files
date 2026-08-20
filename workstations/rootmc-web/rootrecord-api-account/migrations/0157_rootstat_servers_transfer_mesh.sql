-- Transfer mesh: My Servers opt-in for /goto peers (Root-Core).
ALTER TABLE rootstat_servers ADD COLUMN mesh_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rootstat_servers ADD COLUMN transfer_slug TEXT;
ALTER TABLE rootstat_servers ADD COLUMN transfer_slug_index INTEGER NOT NULL DEFAULT 1;
