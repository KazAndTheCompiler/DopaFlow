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
    """Transcribe a spoken command and preview the parsed action without executing it.
    No prefix required — the NLP engine handles intent classification."""

    transcript = transcribe_upload(file, lang=lang).transcript.strip()
    if not transcript:
        raise HTTPException(status_code=422, detail="No speech detected")

    parsed = CommandService.parse(transcript)
    preview = CommandService.preview(transcript)
    command_word = CommandService.detect_command_word(transcript)  # legacy compat

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
            {"id": "task_complete", "name": "Complete task", "description": "Mark a task done by name (fuzzy matching).", "category": "tasks", "example": "done with buy milk", "text": "done with buy milk"},
            {"id": "task_list", "name": "List tasks", "description": "Show open tasks.", "category": "tasks", "example": "show my tasks", "text": "show my tasks"},
            {"id": "journal_create", "name": "Create journal entry", "description": "Create a journal entry from natural language.", "category": "journal", "example": "journal today felt steadier after walking", "text": "journal today felt steadier after walking"},
            {"id": "calendar_create", "name": "Create calendar event", "description": "Create a calendar event from natural language.", "category": "calendar", "example": "schedule dentist tomorrow at 2pm for 45 minutes", "text": "schedule dentist tomorrow at 2pm for 45 minutes"},
            {"id": "focus_start", "name": "Start focus", "description": "Start a focus/pomodoro session.", "category": "focus", "example": "start focus for 25 minutes", "text": "start focus for 25 minutes"},
            {"id": "alarm_create", "name": "Create alarm", "description": "Set an alarm at a specific time.", "category": "alarms", "example": "set alarm at 8am", "text": "set alarm at 8am"},
            {"id": "habit_checkin", "name": "Check in habit", "description": "Log a habit check-in.", "category": "habits", "example": "check in hydration", "text": "check in hydration"},
            {"id": "habit_list", "name": "List habits", "description": "Show current habits and streaks.", "category": "habits", "example": "show habits", "text": "show habits"},
            {"id": "review_start", "name": "Start review", "description": "Start a spaced-repetition review session.", "category": "review", "example": "start review session", "text": "start review session"},
            {"id": "search", "name": "Search", "description": "Search across tasks, journals, and notes.", "category": "search", "example": "find my notes on sleep", "text": "find my notes on sleep"},
            {"id": "nutrition_log", "name": "Log nutrition", "description": "Log food or drink.", "category": "nutrition", "example": "log coffee to nutrition", "text": "log coffee to nutrition"},
            {"id": "undo", "name": "Undo", "description": "Undo the last command.", "category": "meta", "example": "undo that", "text": "undo"},
        ]
    }
