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
    undone_at: str | None = None
    error_json: str | None = None
    result: dict[str, object] | None = None


class CommandParseResponse(BaseModel):
    intent: str
    extracted: dict[str, object] = Field(default_factory=dict)
    confidence: float | None = None
    follow_ups: list[str] = Field(default_factory=list)
    tts_response: str = ""


class CommandPreviewResponse(BaseModel):
    mode: str
    parsed: dict[str, object]
    would_execute: bool
    status: str
    follow_ups: list[str] = Field(default_factory=list)
    tts_response: str = ""
    message: str | None = None
    result: dict[str, object] | None = None
    options: list[dict[str, object]] | None = None
    parts: list[dict[str, object]] | None = None


class CommandExecuteResponse(BaseModel):
    intent: str
    status: str
    result: dict[str, object] | None = None
    reply: str | None = None
    message: str | None = None


class CommandClearHistoryResponse(BaseModel):
    cleared: bool


class CommandListItem(BaseModel):
    id: str
    name: str
    description: str
    category: str
    example: str
    text: str


class CommandListResponse(BaseModel):
    commands: list[CommandListItem]
