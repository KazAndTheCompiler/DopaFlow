ALTER TABLE auth_oidc_codes ADD COLUMN state TEXT;

CREATE INDEX IF NOT EXISTS idx_auth_oidc_codes_state ON auth_oidc_codes(state);
