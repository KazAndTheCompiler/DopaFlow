"""Schemas for APKG review import/export routes."""

from __future__ import annotations

from pydantic import BaseModel


class ReviewApkgExportResponse(BaseModel):
    filename: str
    content_type: str
    encoding: str
    size: int
    data: str


class ReviewApkgImportRouteResponse(BaseModel):
    success: bool
    deck_id: str
    deck_name: str
    cards_created: int


class ReviewDeckNamesResponse(BaseModel):
    decks: list[str]
