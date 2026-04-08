"""Database connectivity and health status checks."""

from __future__ import annotations

import logging
import os
import sqlite3
import time
from datetime import datetime, timezone

from app.core.config import get_settings
from app.core.version import APP_VERSION

_START_TIME = time.time()
logger = logging.getLogger(__name__)


def _env_flag(name: str, legacy_name: str, default: str = "0") -> bool:
    raw = os.getenv(name)
    if raw is None:
        raw = os.getenv(legacy_name, default)
    return raw.lower() in {"1", "true", "yes"}


def _trust_local_clients_enabled() -> bool:
    return _env_flag("DOPAFLOW_TRUST_LOCAL_CLIENTS", "ZOESTM_TRUST_LOCAL_CLIENTS")


def _startup_security_warnings() -> list[str]:
    warnings: list[str] = []
    environment = os.getenv("ENVIRONMENT", "development")
    if _env_flag("DOPAFLOW_DEV_AUTH", "ZOESTM_DEV_AUTH"):
        warnings.append("DOPAFLOW_DEV_AUTH=1 enables dev auth bypass")
    if _trust_local_clients_enabled():
        warnings.append("DOPAFLOW_TRUST_LOCAL_CLIENTS=1 trusts localhost clients without real tokens")
    if os.getenv("WEBHOOK_SIGNING_KEY", "dev-key-change-in-prod") == "dev-key-change-in-prod":
        warnings.append("WEBHOOK_SIGNING_KEY is using the default development value")
    if environment == "production":
        if _env_flag("DOPAFLOW_DEV_AUTH", "ZOESTM_DEV_AUTH"):
            warnings.append("Production mode with DOPAFLOW_DEV_AUTH=1 is unsafe")
        if _trust_local_clients_enabled():
            warnings.append("Production mode with DOPAFLOW_TRUST_LOCAL_CLIENTS=1 is unsafe")
    return warnings


class HealthService:
    @staticmethod
    def _build_payload() -> dict[str, object]:
        settings = get_settings()
        now = time.time()
        uptime_seconds = now - _START_TIME

        db_status = "error"
        memory_depth_days = 0
        try:
            conn = sqlite3.connect(settings.db_path)
            conn.row_factory = sqlite3.Row
            conn.execute("SELECT 1")
            db_status = "ok"
            try:
                row = conn.execute(
                    """
                    SELECT COUNT(DISTINCT date(entry_date)) AS depth
                    FROM journal_entries
                    WHERE COALESCE(TRIM(markdown_body), '') <> ''
                      AND deleted_at IS NULL
                    """
                ).fetchone()
                memory_depth_days = int((row["depth"] if row else 0) or 0)
            except sqlite3.OperationalError as exc:
                if "no such table" not in str(exc).lower():
                    raise
                logger.warning("Health memory depth unavailable: %s", exc)
                memory_depth_days = 0
            conn.close()
        except Exception:  # noqa: BLE001
            db_status = "error"

        return {
            "status": "ok" if db_status == "ok" else "degraded",
            "version": APP_VERSION,
            "features": {
                "webhooks": os.getenv("ENABLE_WEBHOOK_HTTP_DELIVERY", "0") == "1",
                "dev_auth": _env_flag("DOPAFLOW_DEV_AUTH", "ZOESTM_DEV_AUTH"),
                "ai_commands": bool(os.getenv("ANTHROPIC_API_KEY")),
                "local_audio": not _env_flag("DOPAFLOW_DISABLE_LOCAL_AUDIO", "ZOESTM_DISABLE_LOCAL_AUDIO"),
                "trust_local_clients": _trust_local_clients_enabled(),
                "enforce_auth": _env_flag("DOPAFLOW_ENFORCE_AUTH", "ZOESTM_ENFORCE_AUTH"),
                "local_webhooks": _env_flag("DOPAFLOW_ALLOW_LOCAL_WEBHOOK_TARGETS", "ZOESTM_ALLOW_LOCAL_WEBHOOK_TARGETS"),
            },
            "db": db_status,
            "memory_depth_days": memory_depth_days,
            "uptime_seconds": int(uptime_seconds),
            "warnings": _startup_security_warnings(),
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def get_status() -> dict[str, object]:
        """Return system health status, database connectivity, and version."""
        return HealthService._build_payload()

    @staticmethod
    def get_detail() -> dict[str, object]:
        """Return detailed health payload — identical to get_status."""
        return HealthService._build_payload()
