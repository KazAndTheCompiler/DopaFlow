# ENDPOINTS
#   POST   /alarms/{alarm_id}/trigger-audio

"""Routes for alarm audio triggering."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings_dependency
from app.domains.alarms.audio_handler import handle_alarm_audio
from app.middleware.auth_scopes import require_scope

router = APIRouter(tags=["alarms"])


@router.post("/alarms/{alarm_id}/trigger-audio", dependencies=[Depends(require_scope("write:alarms"))])
async def trigger_alarm_audio(alarm_id: str, settings: Settings = Depends(get_settings_dependency)) -> dict:
    """Speak the alarm label and return a resolved YouTube stream URL."""
    return handle_alarm_audio(settings.db_path, alarm_id)
