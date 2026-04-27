"""Enhanced rate limiting configuration with tiered limits."""

from __future__ import annotations

import os
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Request

from app.middleware.rate_limit import RateLimitMiddleware as BaseRateLimitMiddleware


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting tiers."""

    # General API limits
    default_limit_per_minute: int = 60
    authenticated_limit_per_minute: int = 120

    # Command endpoints (higher cost operations)
    command_limit_per_minute: int = 30
    packy_limit_per_minute: int = 20

    # Health checks (more permissive)
    health_limit_per_minute: int = 300

    # Burst allowance (short-term spikes)
    burst_multiplier: float = 2.0
    burst_window_seconds: int = 10

    # Whitelisted paths (no rate limiting)
    whitelisted_paths: set[str] = None

    def __post_init__(self):
        if self.whitelisted_paths is None:
            self.whitelisted_paths = {
                "/api/v2/health",
                "/api/v2/health/live",
                "/api/v2/health/ready",
                "/api/v2/health/metrics",
            }


class TieredRateLimitMiddleware(BaseRateLimitMiddleware):
    """Rate limiting with tiered limits based on authentication and endpoint type."""

    def __init__(
        self,
        app,
        config: RateLimitConfig | None = None,
        *,
        db_path: str | None = None,
        packaged: bool = False,
        auth_checker: Callable[[Request], bool] | None = None,
    ) -> None:
        # Initialize with base class but we'll override dispatch
        self.config = config or RateLimitConfig()
        self.auth_checker = auth_checker

        # Call parent with default limit
        super().__init__(
            app,
            calls_per_minute=self.config.default_limit_per_minute,
            db_path=db_path,
            default_limit_per_minute=self.config.default_limit_per_minute,
            command_limit_per_minute=self.config.command_limit_per_minute,
            packaged=packaged,
        )

    def _get_limit_for_request(self, request: Request) -> int:
        """Determine rate limit based on request characteristics."""
        path = request.url.path

        # Check whitelist
        if path in self.config.whitelisted_paths:
            return float("inf")  # No limit

        # Health endpoints
        if "/health" in path:
            return self.config.health_limit_per_minute

        # Command endpoints
        if any(cmd in path for cmd in ["/packy/", "/commands/", "/quick-add"]):
            return self.config.command_limit_per_minute

        # Authenticated users get higher limits
        if self.auth_checker and self.auth_checker(request):
            return self.config.authenticated_limit_per_minute

        return self.config.default_limit_per_minute


# Production rate limit configuration
PRODUCTION_RATE_LIMITS = RateLimitConfig(
    default_limit_per_minute=int(os.getenv("RATE_LIMIT_DEFAULT", "60")),
    authenticated_limit_per_minute=int(os.getenv("RATE_LIMIT_AUTHENTICATED", "120")),
    command_limit_per_minute=int(os.getenv("RATE_LIMIT_COMMANDS", "30")),
    packy_limit_per_minute=int(os.getenv("RATE_LIMIT_PACKY", "20")),
    health_limit_per_minute=int(os.getenv("RATE_LIMIT_HEALTH", "300")),
)
