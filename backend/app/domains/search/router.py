# ENDPOINTS
#   GET    /search

"""API routes for cross-domain search."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.config import Settings, get_settings_dependency
from app.middleware.auth_scopes import require_scope
from app.domains.search.schemas import SearchResponse
from app.domains.search.search_engine import search

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResponse, dependencies=[Depends(require_scope("read:search"))])
async def run_search(
    q: str = Query(...),
    types: str | None = Query(default=None),
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    settings: Settings = Depends(get_settings_dependency),
) -> SearchResponse:
    if not q.strip():
        return SearchResponse(query=q, results=[], total=0)
    type_list = [item.strip() for item in types.split(",")] if types else None
    results = search(q, settings.db_path, types=type_list, from_date=from_, to_date=to)
    return SearchResponse(query=q, results=results, total=len(results))
