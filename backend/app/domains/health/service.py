"""Database connectivity and health status checks."""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone

from app.core.version import APP_VERSION
from app.domains.health.repository import HealthRepository

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
        warnings.append(
            "DOPAFLOW_TRUST_LOCAL_CLIENTS=1 trusts localhost clients without real tokens"
        )
    if (
        os.getenv("WEBHOOK_SIGNING_KEY", "dev-key-change-in-prod")
        == "dev-key-change-in-prod"
    ):
        warnings.append("WEBHOOK_SIGNING_KEY is using the default development value")
    if environment == "production":
        if _env_flag("DOPAFLOW_DEV_AUTH", "ZOESTM_DEV_AUTH"):
            warnings.append("Production mode with DOPAFLOW_DEV_AUTH=1 is unsafe")
        if _trust_local_clients_enabled():
            warnings.append(
                "Production mode with DOPAFLOW_TRUST_LOCAL_CLIENTS=1 is unsafe"
            )
    return warnings


class HealthService:
    @staticmethod
    def _build_payload(db_path: str) -> dict[str, object]:
        now = time.time()
        uptime_seconds = now - _START_TIME

        repo = HealthRepository(db_path)

        db_status = "error"
        memory_depth_days = 0
        if repo.check_connectivity():
            db_status = "ok"
            memory_depth_days = repo.get_memory_depth_days()

        return {
            "status": "ok" if db_status == "ok" else "degraded",
            "version": APP_VERSION,
            "features": {
                "webhooks": os.getenv("ENABLE_WEBHOOK_HTTP_DELIVERY", "0") == "1",
                "dev_auth": _env_flag("DOPAFLOW_DEV_AUTH", "ZOESTM_DEV_AUTH"),
                "ai_commands": bool(os.getenv("ANTHROPIC_API_KEY")),
                "local_audio": not _env_flag(
                    "DOPAFLOW_DISABLE_LOCAL_AUDIO", "ZOESTM_DISABLE_LOCAL_AUDIO"
                ),
                "trust_local_clients": _trust_local_clients_enabled(),
                "enforce_auth": _env_flag(
                    "DOPAFLOW_ENFORCE_AUTH", "ZOESTM_ENFORCE_AUTH"
                ),
                "local_webhooks": _env_flag(
                    "DOPAFLOW_ALLOW_LOCAL_WEBHOOK_TARGETS",
                    "ZOESTM_ALLOW_LOCAL_WEBHOOK_TARGETS",
                ),
            },
            "db": db_status,
            "memory_depth_days": memory_depth_days,
            "uptime_seconds": int(uptime_seconds),
            "warnings": _startup_security_warnings(),
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def get_status(db_path: str) -> dict[str, object]:
        """Return system health status, database connectivity, and version."""
        return HealthService._build_payload(db_path)

    @staticmethod
    def get_detail(db_path: str) -> dict[str, object]:
        """Return detailed health payload — identical to get_status."""
        return HealthService._build_payload(db_path)

    @staticmethod
    def get_ready(db_path: str) -> dict[str, object]:
        repo = HealthRepository(db_path)

        readiness = repo.get_readiness()
        if readiness.get("error") is not None:
            return {
                "status": "not_ready",
                "reason": f"database unavailable: {readiness['error']}",
            }

        status = readiness.get("status", "not_ready")

        # Alembic-based check: database is stamped and current
        if status == "ready" and readiness.get("alembic_version"):
            return {"status": "ready", "reason": None}

        # Legacy fallback: database still using _migrations table
        if status == "migrating":
            user_version = readiness.get("user_version", 0)
            applied = readiness.get("applied", {})
            from app.core.database import _migration_checksum, _migrations_dir

            migration_files = sorted(_migrations_dir().glob("*.sql"))
            latest_version = 0
            if migration_files:
                latest_version = int(migration_files[-1].name.split("_", 1)[0])

            if user_version not in {0, latest_version}:
                return {
                    "status": "not_ready",
                    "reason": f"database user_version {user_version} does not match {latest_version}",
                }

            for migration_file in migration_files:
                applied_checksum = applied.get(migration_file.name)
                if applied_checksum is None:
                    return {
                        "status": "not_ready",
                        "reason": f"pending migration: {migration_file.name}",
                    }
                checksum = _migration_checksum(
                    migration_file.read_text(encoding="utf-8")
                )
                if applied_checksum and applied_checksum != checksum:
                    return {
                        "status": "not_ready",
                        "reason": f"migration checksum mismatch: {migration_file.name}",
                    }

            return {"status": "ready", "reason": None}

        return {
            "status": "not_ready",
            "reason": readiness.get("error", "unknown state"),
        }
