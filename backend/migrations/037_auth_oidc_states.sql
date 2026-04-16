CREATE TABLE IF NOT EXISTS auth_oidc_states (
    state_hash TEXT PRIMARY KEY,
    provider_name TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    scope TEXT NOT NULL,
    client_id TEXT NOT NULL,
    original_state TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_oidc_states_expires_at ON auth_oidc_states(expires_at);