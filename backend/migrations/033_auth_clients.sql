CREATE TABLE IF NOT EXISTS auth_clients (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL UNIQUE,
    client_secret_hash TEXT,
    client_name TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'openid profile email',
    pkce_required INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_clients_client_id ON auth_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_auth_clients_active ON auth_clients(active);
