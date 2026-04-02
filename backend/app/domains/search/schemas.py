"""Schemas for cross-domain search."""

from __future__ import annotations

from pydantic import BaseModel


class SearchResult(BaseModel):
    id: str
    type: str
    title: str
    snippet: str
    date: str | None = None


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    total: int
