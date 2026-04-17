"""Authentication middleware for local-trust and remote API-key access."""

from __future__ import annotations

import os
from secrets import compare_digest

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

TRUSTED_HOSTS = {"127.0.0.1", "localhost", "::1"}
HEALTH_PATHS = {"/health", "/health/live", "/health/ready", "/health/metrics"}


def _env_flag(name: str) -> bool:
    primary = f"DOPAFLOW_{name}"
    legacy = f"ZOESTM_{name}"
    value = os.getenv(primary)
    if value is None:
        value = os.getenv(legacy, "0")
    return value.lower() in {"1", "true", "yes"}


def trust_local_clients_enabled() -> bool:
    """Return whether loopback callers may bypass API-key checks."""

    return _env_flag("TRUST_LOCAL_CLIENTS")


class AuthMiddleware(BaseHTTPMiddleware):
    """Trust local desktop/dev traffic and gate remote requests with an API key."""

    def __init__(self, app, settings) -> None:
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next) -> Response:
        """Apply the local trust boundary before enforcing remote authentication."""

        if request.url.path in HEALTH_PATHS:
            return await call_next(request)

        host = request.client.host if request.client else ""

        if self.settings.dev_auth and not self.settings.production:
            return await call_next(request)

        if host in TRUSTED_HOSTS and trust_local_clients_enabled():
            return await call_next(request)

        if self.settings.enforce_auth:
            api_key = request.headers.get("x-api-key", "")
            expected_api_key = getattr(self.settings, "api_key", "") or ""
            if (
                not api_key
                or not expected_api_key
                or not compare_digest(api_key, expected_api_key)
            ):
                return Response("Unauthorized", status_code=401)

        return await call_next(request)
