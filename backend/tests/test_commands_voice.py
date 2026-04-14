from __future__ import annotations

import pytest
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient

from app.domains.commands.service import CommandService


def test_detect_command_word_recognizes_explicit_prefixes() -> None:
    assert CommandService.detect_command_word("task buy milk tomorrow") == "task"
    assert CommandService.detect_command_word("journal today was rough") == "journal"
    assert (
        CommandService.detect_command_word("calendar dentist tomorrow at 14:00")
        == "calendar"
    )


def test_detect_command_word_returns_none_without_prefix() -> None:
    assert CommandService.detect_command_word("buy milk tomorrow") is None


def test_voice_preview_route_exists_on_commands_router() -> None:
    from app.domains.commands.router import router

    paths = {route.path for route in router.routes if isinstance(route, APIRoute)}

    assert "/commands/voice-preview" in paths


@pytest.mark.anyio
async def test_voice_preview_works_without_prefix(monkeypatch) -> None:
    """NLP engine handles intent classification — no prefix required."""
    from fastapi import FastAPI

    from app.domains.commands import router as commands_router_module
    from app.domains.commands.router import router

    class DummyResult:
        transcript = "buy milk tomorrow"

    monkeypatch.setenv("DOPAFLOW_DEV_AUTH", "true")
    monkeypatch.setattr(
        commands_router_module,
        "transcribe_upload",
        lambda file, lang="en-US": DummyResult(),
    )

    app = FastAPI()
    app.include_router(router, prefix="/api/v2")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/v2/commands/voice-preview",
            files={"file": ("voice.webm", b"fake-audio", "audio/webm")},
        )

    assert response.status_code == 200
    body = response.json()
    # No prefix required — NLP engine classifies intent
    assert body["status"] == "ok"
    assert body["parsed"]["intent"] == "task.create"
    assert body["preview"]["would_execute"] is True


def test_parse_task_command_uses_explicit_task_prefix() -> None:
    parsed = CommandService.parse("task buy milk tomorrow")

    assert parsed["intent"] == "task.create"
    assert parsed["extracted"]["title"] == "buy milk"


def test_parse_journal_command_uses_explicit_journal_prefix() -> None:
    parsed = CommandService.parse("journal today felt clearer after walking")

    assert parsed["intent"] == "journal.create"
    assert parsed["extracted"]["markdown_body"] == "today felt clearer after walking"


def test_parse_calendar_command_extracts_basic_time_window() -> None:
    parsed = CommandService.parse("calendar dentist tomorrow at 14:00 for 45 minutes")

    assert parsed["intent"] == "calendar.create"
    assert parsed["extracted"]["title"] == "dentist"
    assert parsed["extracted"]["start_at"] is not None
    assert parsed["extracted"]["end_at"] is not None


def test_preview_marks_calendar_command_needs_datetime_without_time() -> None:
    preview = CommandService.preview("calendar dentist tomorrow")

    assert preview["status"] == "needs_datetime"
    assert preview["would_execute"] is False


@pytest.mark.anyio
async def test_voice_preview_returns_needs_datetime_for_calendar_without_time(
    monkeypatch,
) -> None:
    from fastapi import FastAPI

    from app.domains.commands import router as commands_router_module
    from app.domains.commands.router import router

    class DummyResult:
        transcript = "calendar dentist tomorrow"

    monkeypatch.setenv("DOPAFLOW_DEV_AUTH", "true")
    monkeypatch.setattr(
        commands_router_module,
        "transcribe_upload",
        lambda file, lang="en-US": DummyResult(),
    )

    app = FastAPI()
    app.include_router(router, prefix="/api/v2")
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            "/api/v2/commands/voice-preview",
            files={"file": ("voice.webm", b"fake-audio", "audio/webm")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "needs_datetime"
    assert body["preview"]["would_execute"] is False
