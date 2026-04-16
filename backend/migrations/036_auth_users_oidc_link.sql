ALTER TABLE auth_users ADD COLUMN oidc_issuer TEXT;
ALTER TABLE auth_users ADD COLUMN oidc_subject TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_oidc_link
    ON auth_users(oidc_issuer, oidc_subject)
    WHERE oidc_issuer IS NOT NULL AND oidc_subject IS NOT NULL;