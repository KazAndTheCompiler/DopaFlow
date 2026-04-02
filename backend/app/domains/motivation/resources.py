"""Resolve the cached Goggins MP3 resource path."""

from __future__ import annotations

from pathlib import Path


def get_goggins_mp3_path() -> Path | None:
    """Return the path to goggins.mp3 when available."""

    candidates = [
        Path(__file__).parent.parent.parent / "static" / "goggins.mp3",
        Path.home() / ".cache" / "zoestm" / "goggins.mp3",
        Path("/opt/zoesTM/static/goggins.mp3"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None
