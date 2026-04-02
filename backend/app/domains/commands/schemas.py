"""Schemas for command parsing and history."""

from __future__ import annotations

from pydantic import BaseModel


class CommandParseRequest(BaseModel):
    text: str


class CommandExecuteRequest(BaseModel):
    text: str
    confirm: bool = False


class CommandHistoryItem(BaseModel):
    id: str
    text: str
    intent: str
    status: str
    executed_at: str
