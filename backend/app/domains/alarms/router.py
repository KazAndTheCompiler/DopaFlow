# ENDPOINTS
#   GET    /alarms
#   GET    /alarms/upcoming
#   POST   /alarms
#   POST   /alarms/resolve-url
#   GET    /alarms/{identifier}
#   PATCH  /alarms/{identifier}
#   DELETE /alarms/{identifier}
#   POST   /alarms/{identifier}/trigger
#   GET    /alarms/scheduler/status

"""API router for the alarms domain."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import Settings, get_settings_dependency
from app.domains.alarms.repository import AlarmsRepository
from app.domains.alarms.schemas import AlarmCreate, AlarmRead, AlarmSchedulerStatus, AlarmTriggerResponse
from app.domains.alarms.service import AlarmsService
from app.middleware.auth_scopes import require_scope

router = APIRouter(prefix="/alarms", tags=["alarms"])


async def _svc(settings: Settings = Depends(get_settings_dependency)) -> AlarmsService:
    """Build an AlarmsService wired to the real database."""

    return AlarmsService(AlarmsRepository(settings.db_path))


@router.get("", response_model=list[AlarmRead], dependencies=[Depends(require_scope("read:alarms"))])
async def list_alarms(svc: AlarmsService = Depends(_svc)) -> list[AlarmRead]:
    """List all scheduled alarms."""

    return svc.list_alarms()


@router.post("/resolve-url", response_model=dict[str, object], dependencies=[Depends(require_scope("write:alarms"))])
def resolve_alarm_url(
    youtube_url: str = "",
    url: str = "",
) -> dict[str, object]:
    """Resolve a YouTube URL to a direct audio stream URL for alarm playback."""
    from app.domains.player.service import PlayerService
    target = youtube_url or url
    return PlayerService().resolve_url(target)


@router.get("/upcoming", response_model=list[AlarmRead], dependencies=[Depends(require_scope("read:alarms"))])
async def list_upcoming_alarms(svc: AlarmsService = Depends(_svc)) -> list[AlarmRead]:
    """List upcoming alarms for desktop polling."""

    return svc.list_upcoming()


@router.post("", response_model=AlarmRead, status_code=201, dependencies=[Depends(require_scope("write:alarms"))])
async def create_alarm(payload: AlarmCreate, svc: AlarmsService = Depends(_svc)) -> AlarmRead:
    """Schedule a new alarm."""

    return svc.create_alarm(payload)


@router.get("/{identifier}", response_model=AlarmRead, dependencies=[Depends(require_scope("read:alarms"))])
async def get_alarm(identifier: str, svc: AlarmsService = Depends(_svc)) -> AlarmRead:
    """Fetch a single alarm."""

    alarm = svc.get_alarm(identifier)
    if alarm is None:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return alarm


@router.patch("/{identifier}", response_model=AlarmRead, dependencies=[Depends(require_scope("write:alarms"))])
async def update_alarm(identifier: str, patch: dict, svc: AlarmsService = Depends(_svc)) -> AlarmRead:
    """Update alarm fields."""

    alarm = svc.update_alarm(identifier, patch)
    if alarm is None:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return alarm


@router.delete("/{identifier}", response_model=dict, dependencies=[Depends(require_scope("write:alarms"))])
async def delete_alarm(identifier: str, svc: AlarmsService = Depends(_svc)) -> dict:
    """Delete an alarm."""

    if not svc.delete_alarm(identifier):
        raise HTTPException(status_code=404, detail="Alarm not found")
    return {"deleted": True}


@router.post("/{identifier}/trigger", response_model=AlarmTriggerResponse, dependencies=[Depends(require_scope("write:alarms"))])
async def trigger_alarm(identifier: str, svc: AlarmsService = Depends(_svc)) -> AlarmTriggerResponse:
    """Manually fire an alarm (runs TTS, records last_fired_at)."""

    return svc.trigger_alarm(identifier)


@router.get("/scheduler/status", response_model=AlarmSchedulerStatus, dependencies=[Depends(require_scope("read:alarms"))])
async def scheduler_status(svc: AlarmsService = Depends(_svc)) -> AlarmSchedulerStatus:
    """Return the next pending alarm for scheduler health display."""

    return svc.get_scheduler_status()
