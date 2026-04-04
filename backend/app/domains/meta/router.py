"""Introspection endpoints for app metadata and OpenAPI."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.domains.meta.schemas import MetaResponse, VersionResponse

router = APIRouter(prefix="/meta", tags=["meta"])

APP_VERSION = "2.0.7"
SCHEMA_VERSION = "v2"


@router.get("", response_model=MetaResponse)
async def meta_summary() -> MetaResponse:
    """Return app metadata."""

    return MetaResponse(version=APP_VERSION, app_version=APP_VERSION, schema_version=SCHEMA_VERSION)


@router.get("/version", response_model=VersionResponse)
async def version() -> VersionResponse:
    """Return app version."""

    return VersionResponse(version=APP_VERSION, app_version=APP_VERSION)


@router.get("/openapi")
async def openapi_spec(request: Request) -> dict[str, object]:
    """Return the app OpenAPI schema."""

    return request.app.openapi()
