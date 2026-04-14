"""Business logic for the alarms domain."""

from __future__ import annotations

import subprocess

from app.domains.alarms.repository import AlarmsRepository
from app.domains.alarms.schemas import (
    AlarmCreate,
    AlarmRead,
    AlarmSchedulerStatus,
    AlarmTriggerResponse,
)


def _speak(text: str) -> None:
    """Fire OS TTS in a background subprocess (non-blocking). Silenced by env flag."""

    import os

    if os.environ.get("ZOESTM_DISABLE_LOCAL_AUDIO"):
        return
    for cmd in (["spd-say", text], ["say", text], ["espeak", text]):
        try:
            subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
        except FileNotFoundError:
            continue


class AlarmsService:
    """Coordinate alarm scheduling, TTS, and scheduler state."""

    def __init__(self, repository: AlarmsRepository) -> None:
        self.repository = repository

    def list_alarms(self) -> list[AlarmRead]:
        """Return all scheduled alarms."""

        return self.repository.list_alarms()

    def list_upcoming(self) -> list[AlarmRead]:
        """Return upcoming unmuted alarms for desktop polling."""

        return self.repository.list_upcoming()

    def get_alarm(self, identifier: str) -> AlarmRead | None:
        """Fetch a single alarm."""

        return self.repository.get_alarm(identifier)

    def create_alarm(self, payload: AlarmCreate) -> AlarmRead:
        """Schedule a new alarm."""

        return self.repository.create_alarm(payload)

    def update_alarm(self, identifier: str, patch: dict) -> AlarmRead | None:
        """Update alarm fields."""

        return self.repository.update_alarm(identifier, patch)

    def delete_alarm(self, identifier: str) -> bool:
        """Remove an alarm."""

        return self.repository.delete_alarm(identifier)

    def trigger_alarm(self, identifier: str) -> AlarmTriggerResponse:
        """Manually fire an alarm — runs TTS, records last_fired_at."""

        alarm = self.repository.get_alarm(identifier)
        if alarm is None:
            return AlarmTriggerResponse(
                alarm_id=identifier, fired=False, message="Alarm not found"
            )

        tts_text = alarm.tts_text or alarm.title
        _speak(tts_text)
        self.repository.touch_alarm(identifier)
        return AlarmTriggerResponse(
            alarm_id=identifier, fired=True, message=f"Fired: {tts_text}"
        )

    def get_scheduler_status(self) -> AlarmSchedulerStatus:
        """Return the background scheduler heartbeat."""

        return self.repository.scheduler_status()
