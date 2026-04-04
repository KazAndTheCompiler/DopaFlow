"""Database connectivity and health status checks."""

from __future__ import annotations

import os
import sqlite3
import time
from datetime import datetime, timezone

from app.core.config import get_settings

_START_TIME = time.time()

APP_VERSION = "2.0.7"


def _trust_local_clients_enabled() -> bool:
    return os.getenv("ZOESTM_TRUST_LOCAL_CLIENTS", os.getenv("DOPAFLOW_TRUST_LOCAL_CLIENTS", "0")).lower() in {"1", "true", "yes"}


def _startup_security_warnings() -> list[str]:
    warnings: list[str] = []
    environment = os.getenv("ENVIRONMENT", "development")
    if os.getenv("ZOESTM_DEV_AUTH", os.getenv("DOPAFLOW_DEV_AUTH", "0")) == "1":
        warnings.append("ZOESTM_DEV_AUTH=1 enables dev auth bypass")
    if _trust_local_clients_enabled():
        warnings.append("ZOESTM_TRUST_LOCAL_CLIENTS=1 trusts localhost clients without real tokens")
    if os.getenv("WEBHOOK_SIGNING_KEY", "dev-key-change-in-prod") == "dev-key-change-in-prod":
        warnings.append("WEBHOOK_SIGNING_KEY is using the default development value")
    if environment == "production":
        if os.getenv("ZOESTM_DEV_AUTH", "0") == "1":
            warnings.append("Production mode with ZOESTM_DEV_AUTH=1 is unsafe")
        if _trust_local_clients_enabled():
            warnings.append("Production mode with ZOESTM_TRUST_LOCAL_CLIENTS=1 is unsafe")
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
            except Exception:  # noqa: BLE001
                memory_depth_days = 0
            conn.close()
        except Exception:  # noqa: BLE001
            db_status = "error"

        return {
            "status": "ok" if db_status == "ok" else "degraded",
            "version": APP_VERSION,
            "features": {
                "webhooks": os.getenv("ENABLE_WEBHOOK_HTTP_DELIVERY", "0") == "1",
                "dev_auth": os.getenv("ZOESTM_DEV_AUTH", os.getenv("DOPAFLOW_DEV_AUTH", "0")) == "1",
                "ai_commands": bool(os.getenv("ANTHROPIC_API_KEY")),
                "local_audio": os.getenv("ZOESTM_DISABLE_LOCAL_AUDIO", "0") != "1",
                "trust_local_clients": _trust_local_clients_enabled(),
                "enforce_auth": os.getenv("ZOESTM_ENFORCE_AUTH", "0") == "1",
                "local_webhooks": os.getenv("ZOESTM_ALLOW_LOCAL_WEBHOOK_TARGETS", "0") == "1",
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
