"""Command execution routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings_dependency
from app.domains.commands.schemas import CommandExecuteRequest, CommandParseRequest
from app.domains.commands.service import CommandService
from app.domains.commands.repository import CommandRepository
from app.middleware.auth_scopes import require_scope

router = APIRouter(prefix="/commands", tags=["commands"])


@router.post("/parse", dependencies=[Depends(require_scope("read:commands"))])
async def parse_command(payload: CommandParseRequest) -> dict[str, object]:
    """Parse a command string and return the intent without executing."""
    return CommandService.parse(payload.text)


@router.post("/preview", dependencies=[Depends(require_scope("read:commands"))])
async def preview_command(payload: CommandParseRequest) -> dict[str, object]:
    """Dry-run preview: show what would happen if the command were executed."""
    return CommandService.preview(payload.text)


@router.post("/execute", dependencies=[Depends(require_scope("write:commands"))])
async def execute_command(
    payload: CommandExecuteRequest,
    settings: Settings = Depends(get_settings_dependency),
) -> dict[str, object]:
    """Parse and execute a command string."""
    return CommandService.execute(settings.db_path, payload.text, confirm=payload.confirm)


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
            {"id": "task_create", "name": "Create task", "description": "Create a new task from plain language.", "category": "tasks", "example": "add task finish report by tomorrow"},
            {"id": "task_complete", "name": "Complete task", "description": "Mark a task done by name.", "category": "tasks", "example": "complete task finish report"},
            {"id": "focus_start", "name": "Start focus", "description": "Start a focus/pomodoro session.", "category": "focus", "example": "focus 45 minutes"},
            {"id": "alarm_create", "name": "Create alarm", "description": "Set an alarm at a specific time.", "category": "alarms", "example": "set alarm at 08:00"},
            {"id": "habit_list", "name": "List habits", "description": "Show current habits and streaks.", "category": "habits", "example": "list habits"},
        ]
    }
