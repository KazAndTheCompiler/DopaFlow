"""Structured slow-request logging middleware."""

from __future__ import annotations

import json
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("dopaflow.slow_requests")
SLOW_THRESHOLD_MS = 200


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Log requests that exceed the configured slow-request threshold."""

    async def dispatch(self, request: Request, call_next) -> Response:
        """Measure request duration and log JSON for slow requests."""
        request_id = request.headers.get("x-request-id", "").strip() or uuid.uuid4().hex
        client = getattr(request, "client", None)
        client_host = client.host if client and client.host else "unknown"
        start = time.monotonic()
        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.monotonic() - start) * 1000
            logger.exception(
                json.dumps(
                    {
                        "event": "request_error",
                        "request_id": request_id,
                        "path": request.url.path,
                        "method": request.method,
                        "client_host": client_host,
                        "duration_ms": round(duration_ms, 2),
                    }
                )
            )
            raise

        response.headers["X-Request-ID"] = request_id
        duration_ms = (time.monotonic() - start) * 1000
        if duration_ms > SLOW_THRESHOLD_MS:
            logger.warning(
                json.dumps(
                    {
                        "event": "slow_request",
                        "request_id": request_id,
                        "path": request.url.path,
                        "method": request.method,
                        "client_host": client_host,
                        "duration_ms": round(duration_ms, 2),
                        "status": response.status_code,
                    }
                )
            )
        return response
