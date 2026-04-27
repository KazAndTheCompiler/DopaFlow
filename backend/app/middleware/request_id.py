"""Request ID tracing middleware with correlation and logging."""

from __future__ import annotations

import logging
import time
import uuid
from contextvars import ContextVar

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

# Context variable to store request ID across async boundaries
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")
request_start_ctx: ContextVar[float] = ContextVar("request_start", default=0.0)

logger = logging.getLogger("dopaflow.request_trace")


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Middleware to handle request ID tracing and correlation.

    Features:
    - Generates unique request IDs if not provided
    - Propagates request IDs from incoming headers
    - Adds request IDs to response headers
    - Tracks request timing
    - Supports parent/child correlation IDs
    """

    def __init__(
        self,
        app,
        *,
        header_name: str = "x-request-id",
        parent_header_name: str = "x-parent-request-id",
        response_header_name: str = "x-request-id",
        trust_proxy: bool = True,
    ):
        super().__init__(app)
        self.header_name = header_name.lower()
        self.parent_header_name = parent_header_name.lower()
        self.response_header_name = response_header_name
        self.trust_proxy = trust_proxy

    async def dispatch(self, request: Request, call_next) -> Response:
        # Extract or generate request ID
        request_id = self._get_request_id(request)
        parent_id = self._get_parent_id(request)

        # Set context variables
        request_id_ctx.set(request_id)
        request_start_ctx.set(time.monotonic())

        # Store in request state for access in routes
        request.state.request_id = request_id
        request.state.parent_request_id = parent_id
        request.state.request_start_time = time.monotonic()

        # Process request
        try:
            response = await call_next(request)
        finally:
            # Calculate duration
            duration_ms = (time.monotonic() - request_start_ctx.get()) * 1000

            # Log request completion
            self._log_request(request, response, request_id, duration_ms)

        # Add request ID to response headers
        response.headers[self.response_header_name] = request_id
        if parent_id:
            response.headers["x-parent-request-id"] = parent_id

        return response

    def _get_request_id(self, request: Request) -> str:
        """Extract or generate request ID."""
        # Check incoming header
        request_id = request.headers.get(self.header_name, "").strip()

        # Validate format (UUID or alphanumeric)
        if request_id and self._is_valid_request_id(request_id):
            return request_id

        # Generate new request ID
        return self._generate_request_id(request)

    def _get_parent_id(self, request: Request) -> str | None:
        """Extract parent request ID for distributed tracing."""
        parent_id = request.headers.get(self.parent_header_name, "").strip()
        return parent_id if self._is_valid_request_id(parent_id) else None

    def _is_valid_request_id(self, request_id: str) -> bool:
        """Validate request ID format."""
        if not request_id:
            return False
        # Allow UUIDs or alphanumeric strings between 8-64 chars
        if len(request_id) < 8 or len(request_id) > 64:
            return False
        return all(c.isalnum() or c in "-_" for c in request_id)

    def _generate_request_id(self, request: Request) -> str:
        """Generate a new request ID."""
        # Include timestamp prefix for sorting
        timestamp = int(time.time())
        random_suffix = uuid.uuid4().hex[:16]
        return f"{timestamp:x}-{random_suffix}"

    def _log_request(
        self,
        request: Request,
        response: Response,
        request_id: str,
        duration_ms: float,
    ):
        """Log request details with tracing information."""
        client = getattr(request, "client", None)
        client_host = client.host if client else "unknown"

        logger.info(
            "Request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
                "client_host": client_host,
                "user_agent": request.headers.get("user-agent", "unknown"),
            },
        )


def get_current_request_id() -> str:
    """Get the current request ID from context."""
    return request_id_ctx.get()


def get_request_duration_ms() -> float:
    """Get the current request duration in milliseconds."""
    start = request_start_ctx.get()
    if start:
        return (time.monotonic() - start) * 1000
    return 0.0


class TraceContext:
    """Context manager for adding trace context to logs."""

    def __init__(self, operation: str, **extra_fields):
        self.operation = operation
        self.extra_fields = extra_fields
        self.start_time: float | None = None

    def __enter__(self):
        self.start_time = time.monotonic()
        logger.info(
            f"{self.operation} started",
            extra={
                "request_id": get_current_request_id(),
                **self.extra_fields,
            },
        )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = (time.monotonic() - self.start_time) * 1000 if self.start_time else 0
        if exc_val:
            logger.error(
                f"{self.operation} failed",
                extra={
                    "request_id": get_current_request_id(),
                    "duration_ms": round(duration_ms, 2),
                    "error": str(exc_val),
                    **self.extra_fields,
                },
            )
        else:
            logger.info(
                f"{self.operation} completed",
                extra={
                    "request_id": get_current_request_id(),
                    "duration_ms": round(duration_ms, 2),
                    **self.extra_fields,
                },
            )
