"""Structured slow-request logging middleware."""

from __future__ import annotations

import json
import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("dopaflow.slow_requests")
SLOW_THRESHOLD_MS = 200


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Log requests that exceed the configured slow-request threshold."""

    async def dispatch(self, request: Request, call_next) -> Response:
        """Measure request duration and log JSON for slow requests."""

        start = time.monotonic()
        response = await call_next(request)
        duration_ms = (time.monotonic() - start) * 1000
        if duration_ms > SLOW_THRESHOLD_MS:
            logger.warning(
                json.dumps(
                    {
                        "path": request.url.path,
                        "method": request.method,
                        "duration_ms": round(duration_ms, 2),
                        "status": response.status_code,
                    }
                )
            )
        return response
