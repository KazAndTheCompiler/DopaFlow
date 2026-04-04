"""Command execution routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.core.config import Settings, get_settings_dependency
from app.domains.commands.schemas import CommandExecuteRequest, CommandParseRequest, VoiceCommandPreviewResponse
from app.domains.commands.service import CommandService
from app.domains.commands.repository import CommandRepository
from app.middleware.auth_scopes import require_scope
from app.services.speech_to_text import transcribe_upload

router = APIRouter(prefix="/commands", tags=["commands"])


@router.post("/parse", dependencies=[Depends(require_scope("read:commands"))])
async def parse_command(payload: CommandParseRequest) -> dict[str, object]:
    """Parse a command string and return the intent without executing."""
    return CommandService.parse(payload.text)


@router.post("/preview", dependencies=[Depends(require_scope("read:commands"))])
async def preview_command(payload: CommandParseRequest) -> dict[str, object]:
    """Dry-run preview: show what would happen if the command were executed."""
    return CommandService.preview(payload.text)


@router.post("/voice-preview", response_model=VoiceCommandPreviewResponse, dependencies=[Depends(require_scope("read:commands"))])
async def preview_voice_command(
    file: UploadFile = File(...),
    lang: str = Query(default="en-US"),
) -> VoiceCommandPreviewResponse:
    """Transcribe a spoken command and preview the parsed action without executing it."""

    transcript = transcribe_upload(file, lang=lang).transcript.strip()
    command_word = CommandService.detect_command_word(transcript)
    if not transcript:
        raise HTTPException(status_code=422, detail="No speech detected")
    if not command_word:
        parsed = {"intent": "unknown", "confidence": 0.0, "extracted": {}}
        preview = {
            "mode": "dry-run",
            "parsed": parsed,
            "would_execute": False,
            "status": "needs_command_word",
            "message": "Start with task, journal, or calendar.",
            "allowed_prefixes": ["task", "journal", "calendar"],
        }
        return VoiceCommandPreviewResponse(
            transcript=transcript,
            status="needs_command_word",
            command_word=None,
            parsed=parsed,
            preview=preview,
        )
    parsed = CommandService.parse(transcript)
    preview = CommandService.preview(transcript)
    return VoiceCommandPreviewResponse(
        transcript=transcript,
        status=str(preview.get("status") or "ok"),
        command_word=command_word,
        parsed=parsed,
        preview=preview,
    )


@router.post("/execute", dependencies=[Depends(require_scope("write:commands"))])
async def execute_command(
    payload: CommandExecuteRequest,
    settings: Settings = Depends(get_settings_dependency),
) -> dict[str, object]:
    """Parse and execute a command string."""
    return CommandService.execute(settings.db_path, payload.text, confirm=payload.confirm, source=payload.source)


@router.get("/history", dependencies=[Depends(require_scope("read:commands"))])
async def command_history(
    limit: int = 100, settings: Settings = Depends(get_settings_dependency)
) -> list[dict[str, object]]:
    """Fetch recent command logs."""
    return CommandRepository.history(settings.db_path, limit)


@router.delete("/history", dependencies=[Depends(require_scope("write:commands"))])
async def clear_history(settings: Settings = Depends(get_settings_dependency)) -> dict[str, object]:
    """Clear all command history logs."""
    return CommandRepository.clear_history(settings.db_path)


@router.get("/list", dependencies=[Depends(require_scope("read:commands"))])
async def list_commands() -> dict[str, list[dict[str, str]]]:
    """Return available command definitions for discovery."""
    return {
        "commands": [
            {"id": "task_create", "name": "Create task", "description": "Create a new task from plain language.", "category": "tasks", "example": "add task finish report by tomorrow", "text": "task finish report tomorrow"},
            {"id": "journal_create", "name": "Create journal entry", "description": "Create a journal entry from explicit command words.", "category": "journal", "example": "journal today felt steadier after walking", "text": "journal today felt steadier after walking"},
            {"id": "calendar_create", "name": "Create calendar event", "description": "Create a calendar event from explicit command words.", "category": "calendar", "example": "calendar dentist tomorrow at 14:00 for 45 minutes", "text": "calendar dentist tomorrow at 14:00 for 45 minutes"},
            {"id": "task_complete", "name": "Complete task", "description": "Mark a task done by name.", "category": "tasks", "example": "complete task finish report", "text": "complete task finish report"},
            {"id": "focus_start", "name": "Start focus", "description": "Start a focus/pomodoro session.", "category": "focus", "example": "focus 45 minutes", "text": "focus 45 minutes"},
            {"id": "alarm_create", "name": "Create alarm", "description": "Set an alarm at a specific time.", "category": "alarms", "example": "set alarm at 08:00", "text": "set alarm at 08:00"},
            {"id": "habit_list", "name": "List habits", "description": "Show current habits and streaks.", "category": "habits", "example": "list habits", "text": "list habits"},
        ]
    }
