"""Schemas for command parsing and history."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class CommandParseRequest(BaseModel):
    text: str


class CommandExecuteRequest(BaseModel):
    text: str
    confirm: bool = False
    source: Literal["text", "voice"] = "text"


class VoiceCommandPreviewResponse(BaseModel):
    transcript: str
    status: str = "ok"
    command_word: str | None = None
    parsed: dict[str, object]
    preview: dict[str, object]


class VoiceCommandPreviewRequest(BaseModel):
    lang: str = Field(default="en-US", min_length=2, max_length=32)


class CommandHistoryItem(BaseModel):
    id: str
    text: str
    intent: str
    status: str
    source: str = "text"
    executed_at: str
