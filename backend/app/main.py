"""FastAPI entrypoint for the DopaFlow backend."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from app.core.config import default_backup_dir, get_settings
from app.core.database import get_db, run_migrations
from app.core.scheduler import start_scheduler, stop_scheduler
from app.core.version import APP_VERSION
from app.domains.alarms.audio_router import router as alarm_audio_router
from app.domains.alarms.router import router as alarms_router
from app.domains.auth.oidc import build_discovery
from app.domains.auth.oidc_router import router as oidc_external_router
from app.domains.auth.router import router as auth_router
from app.domains.auth.repository import AuthRepository
from app.domains.auth.service import AuthService
from app.domains.boards.router import router as boards_router
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
from app.domains.journal.backup_scheduler import JournalBackupScheduler
from app.domains.journal.repository import JournalRepository
from app.domains.journal.router import router as journal_router
from app.domains.journal.service import JournalService
from app.domains.meta.router import router as meta_router
from app.domains.motivation.router import router as motivation_router
from app.domains.notifications.router import router as notifications_router
from app.domains.nutrition.router import router as nutrition_router
from app.domains.ops.router import router as ops_router
from app.domains.packy.router import router as packy_router
from app.domains.player.router import router as player_router
from app.domains.projects.router import router as projects_router
from app.domains.review.router import router as review_router
from app.domains.search.router import router as search_router
from app.domains.tasks.router import router as tasks_router
from app.domains.vault_bridge.router import router as vault_router
from app.logging_config import configure_logging
from app.middleware.auth import AuthMiddleware
from app.middleware.cors import build_cors_options
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_log import RequestLogMiddleware
from app.middleware.security import CSP, SecurityHeadersMiddleware

API_PREFIX = "/api/v2"
backup_scheduler = JournalBackupScheduler()
logger = logging.getLogger("dopaflow.main")


def _stamp_alembic_if_needed(settings) -> None:
    """Stamp Alembic at head if the alembic_version table is missing.

    This is a one-time operation for existing databases that were
    created by the custom SQL migration runner. After stamping,
    future schema changes go through Alembic.

    Uses direct SQL rather than command.stamp() to avoid env.py
    path resolution issues during startup.
    """
    import sqlite3

    # Check if alembic_version exists
    if settings.turso_url:
        return  # Skip stamping for Turso (handled separately)

    try:
        conn = sqlite3.connect(settings.db_path)
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        if "alembic_version" in tables:
            conn.close()
            return

        # Create the alembic_version table and stamp at head
        conn.execute(
            "CREATE TABLE alembic_version "
            "(version_num VARCHAR(32) NOT NULL, "
            "CONSTRAINT pk_alembic_version PRIMARY KEY (version_num))"
        )
        # Read the latest revision from alembic/versions/
        from pathlib import Path
        versions_dir = Path(__file__).resolve().parent.parent / "alembic" / "versions"
        latest_rev = None
        if versions_dir.exists():
            for f in sorted(versions_dir.glob("*.py")):
                # Parse revision from file
                for line in f.read_text().splitlines():
                    if line.startswith("revision:"):
                        latest_rev = line.split("=")[1].strip().strip("'\"")
                        break
        if latest_rev:
            conn.execute(
                "INSERT INTO alembic_version (version_num) VALUES (?)",
                (latest_rev,),
            )
            conn.commit()
            logger.info("Alembic stamped at revision %s", latest_rev)
        else:
            logger.warning("No Alembic revisions found, skipping stamp")
        conn.close()
    except Exception:
        logger.warning("Alembic stamp skipped (non-critical)", exc_info=True)

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
    (auth_router, API_PREFIX),
    (events_router, API_PREFIX),
    (meta_router, API_PREFIX),
    (oidc_external_router, API_PREFIX),
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
        backup_dir = (
            settings.journal_backup_dir
            if settings.journal_backup_dir
            != settings.model_fields["journal_backup_dir"].default
            else default_backup_dir()
        )
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
    configure_logging(production=settings.production or settings.packaged)

    import os

    if os.getenv("DOPAFLOW_SENTRY_DSN"):
        import sentry_sdk
        from sentry_sdk.integrations.asgi import AsgiIntegration

        sentry_sdk.init(
            dsn=os.getenv("DOPAFLOW_SENTRY_DSN"),
            integrations=[AsgiIntegration()],
            environment=os.getenv("DOPAFLOW_ENV", "production"),
            release=APP_VERSION,
            traces_sample_rate=0.1,
        )

    run_migrations(
        settings.db_path, turso_url=settings.turso_url, turso_token=settings.turso_token
    )

    # Stamp Alembic if not already stamped (dual-phase: custom runner
    # applies SQL migrations, then we mark Alembic as up-to-date).
    try:
        _stamp_alembic_if_needed(settings)
    except Exception:
        logger.warning("Alembic stamp skipped (non-critical)", exc_info=True)

    # Seed env-var-configured OIDC provider into the database
    if settings.oidc_issuer_url:
        AuthService(AuthRepository(settings), settings).register_env_provider()

    app = FastAPI(
        title="DopaFlow API",
        version=APP_VERSION,
        docs_url=f"{API_PREFIX}/docs" if settings.dev_auth else None,
        openapi_url=f"{API_PREFIX}/openapi.json" if settings.dev_auth else None,
        lifespan=lifespan,
    )

    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware, **build_cors_options(settings.extra_cors_origins)
    )
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

    @app.get("/.well-known/openid-configuration", tags=["auth"])
    async def oidc_discovery() -> object:
        return build_discovery(settings)

    @app.get("/.well-known/oauth-authorization-server", tags=["auth"])
    async def oauth_discovery() -> object:
        return build_discovery(settings)

    def _login_page_html(
        client_id: str,
        redirect_uri: str,
        state: str,
        scope: str,
        code_challenge: str,
        code_challenge_method: str,
        error: str | None = None,
        providers: list | None = None,
    ) -> str:
        error_block = f'<p class="error">{error}</p>' if error else ""
        provider_block = ""
        if providers:
            provider_buttons = ""
            for p in providers:
                login_url = (
                    f"/api/v2/auth/oidc/login/{p['name']}"
                    f"?client_id={client_id}&redirect_uri={redirect_uri}"
                    f"&scope={scope}&state={state}"
                    f"&code_challenge={code_challenge}&code_challenge_method=S256"
                )
                display_name = p["name"].replace("-", " ").replace("_", " ").title()
                provider_buttons += f'<a href="{login_url}" class="oidc-btn">Sign in with {display_name}</a>\n'
            provider_block = f"""<div class="oidc-providers">
{provider_buttons}
</div>
<div class="separator"><span>or</span></div>"""
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sign in — DopaFlow</title>
<style>
body {{ font-family: sans-serif; max-width: 400px; margin: 60px auto; padding: 0 20px; }}
h1 {{ margin-bottom: 24px; }}
label {{ display: block; margin-bottom: 4px; font-weight: 500; }}
input[type=email], input[type=password] {{ width: 100%; padding: 8px; margin-bottom: 16px; box-sizing: border-box; }}
button {{ padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%; }}
.error {{ color: #dc2626; margin-bottom: 12px; }}
.oidc-providers {{ margin-bottom: 16px; }}
.oidc-btn {{ display: block; width: 100%; padding: 10px 20px; background: #1e40af; color: white; text-align: center; text-decoration: none; border-radius: 4px; margin-bottom: 8px; box-sizing: border-box; }}
.oidc-btn:hover {{ background: #1e3a8a; }}
.separator {{ text-align: center; margin: 16px 0; position: relative; }}
.separator::before {{ content: ''; position: absolute; left: 0; top: 50%; width: 100%; border-top: 1px solid #d1d5db; }}
.separator span {{ background: white; padding: 0 12px; position: relative; color: #6b7280; }}
</style>
</head>
<body>
<h1>Sign in to DopaFlow</h1>
{error_block}
{provider_block}
<form method="post" action="/authorize">
<input type="hidden" name="state" value="{state}">
<input type="hidden" name="code_challenge" value="{code_challenge}">
<input type="hidden" name="code_challenge_method" value="{code_challenge_method}">
<input type="hidden" name="redirect_uri" value="{redirect_uri}">
<input type="hidden" name="client_id" value="{client_id}">
<input type="hidden" name="scope" value="{scope}">
<label for="email">Email</label>
<input type="email" id="email" name="email" required autocomplete="email">
<label for="password">Password</label>
<input type="password" id="password" name="password" required autocomplete="current-password">
<button type="submit">Sign in</button>
</form>
</body>
</html>"""

    svc = AuthService(AuthRepository(settings), settings)

    @app.get("/authorize", tags=["auth"])
    async def authorize_get(
        response_type: str,
        client_id: str,
        redirect_uri: str,
        scope: str = "openid profile email",
        state: str = "",
        code_challenge: str = "",
        code_challenge_method: str = "S256",
    ):
        if response_type != "code":
            return JSONResponse(
                status_code=400, content={"detail": "response_type must be 'code'"}
            )
        if code_challenge_method != "S256":
            return JSONResponse(
                status_code=400,
                content={"detail": "code_challenge_method must be 'S256'"},
            )
        if len(state) < 16:
            return JSONResponse(
                status_code=400,
                content={"detail": "state must be at least 16 characters"},
            )
        if len(code_challenge) < 43:
            return JSONResponse(
                status_code=400,
                content={"detail": "code_challenge must be at least 43 characters"},
            )
        return HTMLResponse(
            content=_login_page_html(
                client_id=client_id,
                redirect_uri=redirect_uri,
                state=state,
                scope=scope,
                code_challenge=code_challenge,
                code_challenge_method=code_challenge_method,
                providers=svc.get_enabled_providers(),
            )
        )

    @app.post("/authorize", tags=["auth"])
    async def authorize_post(
        email: str,
        password: str,
        state: str,
        code_challenge: str,
        code_challenge_method: str,
        redirect_uri: str,
        client_id: str,
        scope: str = "openid profile email",
    ):
        if code_challenge_method != "S256":
            return JSONResponse(
                status_code=400,
                content={"detail": "code_challenge_method must be 'S256'"},
            )
        try:
            user = svc.authenticate_user(email, password)
        except HTTPException:
            return HTMLResponse(
                status_code=401,
                content=_login_page_html(
                    client_id=client_id,
                    redirect_uri=redirect_uri,
                    state=state,
                    scope=scope,
                    code_challenge=code_challenge,
                    code_challenge_method=code_challenge_method,
                    error="Invalid email or password",
                ),
            )
        code = svc.create_auth_code(
            client_id=client_id,
            redirect_uri=redirect_uri,
            code_verifier=code_challenge,
            scope=scope,
            user_id=user["id"],
            email=user["email"],
            state=state,
        )
        separator = "&" if "?" in redirect_uri else "?"
        return RedirectResponse(
            url=f"{redirect_uri}{separator}code={code}&state={state}",
            status_code=302,
        )

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
