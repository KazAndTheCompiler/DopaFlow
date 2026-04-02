"""Standalone alarm audio trigger helpers."""

from __future__ import annotations

from app.core.db_utils import get_conn
from app.services import tts as tts_service
from app.services.player import resolve_stream_url


def _fetch_alarm_row(db_path: str, alarm_id: str) -> dict | None:
    """Read one alarm row directly - avoids depending on service layer."""
    conn = get_conn(db_path)
    row = conn.execute("SELECT * FROM alarms WHERE id = ?", (alarm_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def handle_alarm_audio(db_path: str, alarm_id: str) -> dict:
    """
    Speak the alarm label via TTS and resolve a YouTube stream URL if set.
    Returns {"stream_url": str | None, "spoke": str}.
    Never raises - failures are returned as {"error": str}.
    """
    row = _fetch_alarm_row(db_path, alarm_id)
    if not row:
        return {"stream_url": None, "spoke": None, "error": "alarm_not_found"}

    spoke = row.get("tts_text") or row.get("label") or row.get("title") or "Alarm"
    tts_service.speak(spoke)

    stream_url = None
    youtube_url = row.get("youtube_url") or row.get("youtube_link") or ""
    if youtube_url:
        result = resolve_stream_url(youtube_url)
        stream_url = result.get("stream_url")

    return {"stream_url": stream_url, "spoke": spoke}
