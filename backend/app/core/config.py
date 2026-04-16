"""Environment-backed application settings."""

from __future__ import annotations

import pathlib
from functools import lru_cache

from platformdirs import user_data_dir as _platform_user_data_dir
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_NAME = "DopaFlow"


def user_data_dir() -> pathlib.Path:
    return pathlib.Path(_platform_user_data_dir(APP_NAME, appauthor=False))


def default_db_path() -> str:
    return str(user_data_dir() / "db.sqlite")


def default_backup_dir() -> str:
    return str(user_data_dir() / "journal-backup")


DEFAULT_DB = default_db_path()
DEFAULT_BACKUP = default_backup_dir()


class Settings(BaseSettings):
    """Central runtime settings for backend, desktop, and integrations."""

    db_path: str = DEFAULT_DB
    turso_url: str | None = None
    turso_token: str | None = None
    turso_replica_url: str | None = None

    dev_auth: bool = False
    enforce_auth: bool = False
    api_key: str | None = None
    auth_token_secret: str | None = None
    ops_secret: str | None = None
    auth_token_issuer: str = "dopaflow"

    google_client_id: str | None = None
    google_client_secret: str | None = None
    base_url: str = "http://127.0.0.1:8000"
    google_redirect_uri: str = "http://localhost:8000/api/v2/calendar/auth/callback"
    enable_oauth: bool = False

    # External OIDC provider (optional — SSO via Keycloak, Zitadel, etc.)
    oidc_provider_name: str | None = None
    oidc_issuer_url: str | None = None
    oidc_client_id: str | None = None
    oidc_client_secret: str | None = None
    oidc_scopes: str = "openid profile email"
    oidc_default_role: str = "viewer"

    disable_local_audio: bool = False
    disable_background_jobs: bool = False
    packaged: bool = False
    production: bool = False
    extra_cors_origins: str = ""

    journal_backup_dir: str = DEFAULT_BACKUP

    model_config = SettingsConfigDict(
        env_prefix="DOPAFLOW_",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    @model_validator(mode="after")
    def reject_dev_auth_in_production(self) -> Settings:
        if self.dev_auth and self.production:
            raise ValueError(
                "dev_auth=True is not permitted when production=True. "
                "Either unset DOPAFLOW_DEV_AUTH or set DOPAFLOW_PRODUCTION=false."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings instance."""

    return Settings()


async def get_settings_dependency() -> Settings:
    """Async-friendly FastAPI dependency wrapper around cached settings."""

    return get_settings()
