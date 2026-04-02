"""CORS helpers for DopaFlow desktop and local web clients."""

from __future__ import annotations

_DEFAULT_ORIGINS = [
    "app://.",
    "file://",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
]


def build_cors_options(extra_origins: str = "") -> dict[str, object]:
    """Return the canonical CORS configuration for trusted local clients.

    Pass ``extra_origins`` (comma-separated) to allow additional origins,
    e.g. a self-hosted PWA domain set via ``DOPAFLOW_EXTRA_CORS_ORIGINS``.
    """

    origins = list(_DEFAULT_ORIGINS)
    for origin in extra_origins.split(","):
        origin = origin.strip()
        if origin and origin not in origins:
            origins.append(origin)

    return {
        "allow_origins": origins,
        "allow_credentials": True,
        "allow_methods": ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Authorization", "Content-Type", "x-api-key"],
    }
