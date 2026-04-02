"""Authentication middleware for local-trust and remote API-key access."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

TRUSTED_ORIGINS = {"app://", "file://"}
TRUSTED_HOSTS = {"127.0.0.1", "localhost", "::1"}


class AuthMiddleware(BaseHTTPMiddleware):
    """Trust local desktop/dev traffic and gate remote requests with an API key."""

    def __init__(self, app, settings) -> None:
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next) -> Response:
        """Apply the local trust boundary before enforcing remote authentication."""

        if request.url.path == "/health":
            return await call_next(request)

        origin = request.headers.get("origin", "")
        host = request.client.host if request.client else ""

        if any(origin.startswith(prefix) for prefix in TRUSTED_ORIGINS) or host in TRUSTED_HOSTS or self.settings.dev_auth:
            return await call_next(request)

        if self.settings.enforce_auth:
            api_key = request.headers.get("x-api-key", "")
            if not api_key or api_key != self.settings.api_key:
                return Response("Unauthorized", status_code=401)

        return await call_next(request)
