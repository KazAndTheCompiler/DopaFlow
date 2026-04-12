"""FastAPI entrypoint for the DopaFlow backend."""

from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import default_backup_dir, get_settings
from app.core.database import get_db, run_migrations
from app.core.scheduler import start_scheduler, stop_scheduler
from app.core.version import APP_VERSION
from app.domains.boards.router import router as boards_router
from app.domains.alarms.audio_router import router as alarm_audio_router
from app.domains.alarms.router import router as alarms_router
from app.domains.calendar.router import router as calendar_router
from app.domains.calendar_sharing.router import router as calendar_sharing_router
from app.domains.commands.router import router as commands_router
from app.domains.digest.router import router as digest_router
from app.domains.events.router import router as events_router
from app.domains.focus.router import router as focus_router
from app.domains.gamification.router import router as gamification_router
from app.domains.goals.router import router as goals_router
from app.domains.habits.router import router as habits_router
from app.domains.health.router import router as health_router
from app.domains.health.service import HealthService
from app.domains.insights.router import router as insights_router
from app.domains.integrations.router import router as integrations_router
from app.domains.journal.repository import JournalRepository
from app.domains.journal.backup_scheduler import JournalBackupScheduler
from app.domains.journal.router import router as journal_router
from app.domains.journal.service import JournalService
from app.domains.meta.router import router as meta_router
from app.domains.motivation.router import router as motivation_router
from app.domains.nutrition.router import router as nutrition_router
from app.domains.notifications.router import router as notifications_router
from app.domains.ops.router import router as ops_router
from app.domains.packy.router import router as packy_router
from app.domains.player.router import router as player_router
from app.domains.review.router import router as review_router
from app.domains.search.router import router as search_router
from app.domains.tasks.router import router as tasks_router
from app.domains.projects.router import router as projects_router
from app.logging_config import configure_logging
from app.domains.vault_bridge.router import router as vault_router
from app.middleware.auth import AuthMiddleware
from app.middleware.cors import build_cors_options
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_log import RequestLogMiddleware
from app.middleware.security import CSP, SecurityHeadersMiddleware

API_PREFIX = "/api/v2"
backup_scheduler = JournalBackupScheduler()
logger = logging.getLogger("dopaflow.main")

_DOMAIN_ROUTERS = [
    (tasks_router, "/tasks"),
    (projects_router, "/projects"),
    (boards_router, "/boards"),
    (habits_router, "/habits"),
    (focus_router, "/focus"),
    (gamification_router, "/gamification"),
    (goals_router, "/goals"),
    (review_router, "/review"),
    (journal_router, "/journal"),
    (calendar_router, "/calendar"),
    (calendar_sharing_router, "/calendar/sharing"),
    (alarms_router, "/alarms"),
    (nutrition_router, "/nutrition"),
    (packy_router, "/packy"),
    (player_router, "/player"),
    (insights_router, "/insights"),
    (integrations_router, "/integrations"),
    (notifications_router, "/notifications"),
    (search_router, "/search"),
    (motivation_router, "/motivation"),
    (health_router, ""),
    (digest_router, ""),
    (commands_router, ""),
]

_AUXILIARY_ROUTERS = (
    (alarm_audio_router, API_PREFIX),
    (events_router, API_PREFIX),
    (meta_router, API_PREFIX),
    (ops_router, API_PREFIX),
    (vault_router, API_PREFIX),
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    try:
        with get_db(settings.db_path) as conn:
            conn.execute("PRAGMA user_version").fetchone()
    except Exception:
        logger.critical("Database unreachable at startup")
        raise RuntimeError("Database unreachable at startup") from None
    backup_task: asyncio.Task[None] | None = None
    if not settings.disable_background_jobs:
        backup_dir = settings.journal_backup_dir if settings.journal_backup_dir != settings.model_fields["journal_backup_dir"].default else default_backup_dir()
        journal_service = JournalService(
            JournalRepository(settings),
            backup_dir=backup_dir,
        )
        backup_scheduler.configure(
            settings=settings,
            backup_dir=backup_dir,
        )
        start_scheduler(journal_service)
        backup_task = asyncio.create_task(backup_scheduler.start())
    yield
    backup_scheduler.stop()
    if backup_task is not None:
        backup_task.cancel()
        with suppress(asyncio.CancelledError):
            await backup_task
    stop_scheduler()


def register_routers(app: FastAPI) -> None:
    """Attach all API routers to the provided FastAPI app."""

    for domain_router, domain_prefix in _DOMAIN_ROUTERS:
        existing_prefix = getattr(domain_router, "prefix", "") or ""
        if existing_prefix and domain_prefix.endswith(existing_prefix):
            mount_prefix = domain_prefix[: -len(existing_prefix)]
        else:
            mount_prefix = domain_prefix
        app.include_router(domain_router, prefix=f"{API_PREFIX}{mount_prefix}")

    for router, prefix in _AUXILIARY_ROUTERS:
        app.include_router(router, prefix=prefix)


def create_app() -> FastAPI:
    """Create and configure the DopaFlow FastAPI application."""

    settings = get_settings()
    configure_logging(packaged=settings.packaged)
    run_migrations(settings.db_path, turso_url=settings.turso_url, turso_token=settings.turso_token)

    app = FastAPI(
        title="DopaFlow API",
        version=APP_VERSION,
        docs_url=f"{API_PREFIX}/docs" if settings.dev_auth else None,
        openapi_url=f"{API_PREFIX}/openapi.json" if settings.dev_auth else None,
        lifespan=lifespan,
    )

    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(CORSMiddleware, **build_cors_options(settings.extra_cors_origins))
    app.add_middleware(
        RateLimitMiddleware,
        calls_per_minute=120,
        db_path=settings.db_path,
        packaged=settings.packaged,
    )
    app.add_middleware(AuthMiddleware, settings=settings)
    app.add_middleware(RequestLogMiddleware)

    @app.middleware("http")
    async def add_content_security_policy(request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = CSP
        return response

    register_routers(app)

    @app.get("/health/live", tags=["system"])
    async def health_live() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health", tags=["system"])
    async def healthcheck() -> dict[str, str]:
        """Return a minimal liveness payload for desktop startup checks."""

        return {"status": "ok", "app": "dopaflow", "version": APP_VERSION}

    @app.get("/health/ready", tags=["system"])
    async def readiness(response: Response) -> dict[str, object]:
        payload = HealthService.get_ready(settings.db_path)
        if payload["status"] != "ready":
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return payload

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
