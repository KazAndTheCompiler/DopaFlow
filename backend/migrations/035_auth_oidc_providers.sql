CREATE TABLE IF NOT EXISTS auth_oidc_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    issuer_url TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT 'openid profile email',
    enabled INTEGER NOT NULL DEFAULT 1,
    default_role TEXT NOT NULL DEFAULT 'viewer' CHECK (default_role IN ('admin', 'editor', 'viewer')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_oidc_providers_enabled ON auth_oidc_providers(enabled);