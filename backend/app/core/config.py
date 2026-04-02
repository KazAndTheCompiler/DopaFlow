"""Environment-backed application settings."""

from __future__ import annotations

import pathlib
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_DB = str(pathlib.Path.home() / ".local" / "share" / "DopaFlow" / "db.sqlite")
DEFAULT_BACKUP = str(pathlib.Path.home() / ".local" / "share" / "DopaFlow" / "journal-backup")


class Settings(BaseSettings):
    """Central runtime settings for backend, desktop, and integrations."""

    db_path: str = DEFAULT_DB
    turso_url: str | None = None
    turso_token: str | None = None

    dev_auth: bool = False
    enforce_auth: bool = False
    api_key: str | None = None
    auth_token_secret: str | None = None
    auth_token_issuer: str = "dopaflow"

    google_client_id: str | None = None
    google_client_secret: str | None = None
    base_url: str = "http://127.0.0.1:8000"
    google_redirect_uri: str = "http://localhost:8000/api/v2/calendar/auth/callback"
    enable_oauth: bool = False

    disable_local_audio: bool = False
    disable_background_jobs: bool = False
    packaged: bool = False
    extra_cors_origins: str = ""  # comma-separated additional allowed origins

    journal_backup_dir: str = DEFAULT_BACKUP

    model_config = SettingsConfigDict(
        env_prefix="DOPAFLOW_",
        env_file=".env",
        env_file_encoding="utf-8",
    )


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings instance."""

    return Settings()


async def get_settings_dependency() -> Settings:
    """Async-friendly FastAPI dependency wrapper around cached settings."""

    return get_settings()
