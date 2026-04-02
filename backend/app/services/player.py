"""Resolve direct audio stream URLs from YouTube links via yt-dlp."""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import sys

logger = logging.getLogger("dopaflow.player")


def _find_yt_dlp() -> list[str] | None:
    """Return the yt-dlp command prefix, or None if unavailable."""
    found = shutil.which("yt-dlp")
    if found:
        return [found]
    home = os.path.expanduser("~")
    candidates = [
        os.path.join(home, ".local", "bin", "yt-dlp"),
        "/usr/local/bin/yt-dlp",
        "/usr/bin/yt-dlp",
    ]
    for candidate in candidates:
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return [candidate]
    try:
        import yt_dlp  # noqa: F401

        return [sys.executable, "-m", "yt_dlp"]
    except ImportError:
        return None


def resolve_stream_url(youtube_url: str) -> dict[str, str | None]:
    """
    Return {"stream_url": "...", "error": None} on success.
    Return {"stream_url": None, "error": "reason"} on failure.
    Never raises.
    """
    if not youtube_url.startswith(("http://", "https://")):
        return {"stream_url": None, "error": "invalid_url"}

    cmd_prefix = _find_yt_dlp()
    if not cmd_prefix:
        return {"stream_url": None, "error": "yt_dlp_unavailable"}

    try:
        result = subprocess.run(
            [*cmd_prefix, "-f", "bestaudio", "-g", "--no-playlist", youtube_url],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode != 0:
            hint = (result.stderr or "").strip()[:200]
            return {"stream_url": None, "error": hint or "resolve_failed"}
        stream_url = result.stdout.strip().splitlines()[0]
        return {"stream_url": stream_url, "error": None}
    except subprocess.TimeoutExpired:
        return {"stream_url": None, "error": "timeout"}
    except Exception as exc:
        return {"stream_url": None, "error": str(exc)}
