"""Player service — real yt-dlp URL resolution."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

from app.domains.player.repository import PlayerRepository


def _find_yt_dlp() -> list[str] | None:
    found = shutil.which("yt-dlp")
    if found:
        return [found]
    home = os.path.expanduser("~")
    candidates = [
        os.path.join(home, ".local", "bin", "yt-dlp"),
        "/usr/local/bin/yt-dlp",
        "/usr/bin/yt-dlp",
    ]
    for c in candidates:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return [c]
    # Do NOT fall back to sys.executable -m yt_dlp when frozen (PyInstaller):
    # sys.executable is the bundle itself, not a Python interpreter.
    if not getattr(sys, "frozen", False):
        try:
            import yt_dlp  # noqa: F401
            return [sys.executable, "-m", "yt_dlp"]
        except ImportError:
            pass
    return None


def _resolve_via_api(url: str) -> dict[str, object]:
    """Use the yt-dlp Python API directly (works in PyInstaller bundles)."""
    try:
        from yt_dlp import YoutubeDL  # type: ignore[import-untyped]
        ydl_opts = {
            "format": "bestaudio",
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
        }
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            stream_url = info.get("url") if info else None
            if not stream_url and info and info.get("formats"):
                stream_url = info["formats"][-1].get("url")
            return {"stream_url": stream_url, "error": None}
    except Exception as exc:  # noqa: BLE001
        return {"stream_url": None, "error": str(exc)}


class PlayerService:
    def __init__(self, repository: PlayerRepository | None = None) -> None:
        self.repository = repository or PlayerRepository()

    def resolve_url(self, url: str) -> dict[str, object]:
        if not url:
            return {"stream_url": None, "error": "A URL is required"}
        if not url.startswith(("http://", "https://")):
            return {"stream_url": None, "error": "Only http and https URLs are supported"}

        cmd_prefix = _find_yt_dlp()
        if cmd_prefix:
            try:
                result = subprocess.run(
                    [*cmd_prefix, "-f", "bestaudio", "-g", "--no-playlist", url],
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
                if result.returncode != 0:
                    # Subprocess failed — try Python API as fallback
                    return _resolve_via_api(url)
                stream_url = result.stdout.strip().splitlines()[0] if result.stdout.strip() else None
                return {"stream_url": stream_url, "error": None}
            except subprocess.TimeoutExpired:
                return {"stream_url": None, "error": "yt-dlp timed out"}
            except Exception as exc:  # noqa: BLE001
                return {"stream_url": None, "error": str(exc)}

        # No yt-dlp binary found — use Python API directly (works in PyInstaller bundles)
        return _resolve_via_api(url)

    def save_queue(self, items: list[dict[str, object]] | None = None) -> dict[str, object]:
        # Normalise: accept list of URLs (str) or dicts
        raw = items or []
        urls: list[str] = []
        seen: set[str] = set()
        for item in raw:
            url = item if isinstance(item, str) else str(item.get("url") or item.get("src") or "")
            url = url.strip()
            if url and url not in seen:
                urls.append(url)
                seen.add(url)
            if len(urls) >= 20:
                break
        queue = self.repository.save_queue(urls)
        return {"items": queue, "count": len(queue)}

    def get_queue(self) -> dict[str, object]:
        queue = self.repository.get_queue()
        return {"items": queue, "count": len(queue)}

    def next_track(self) -> dict[str, object]:
        return {"item": self.repository.pop_next(), "remaining": len(self.repository.get_queue())}

    def enqueue_predownload(self, payload: dict[str, object]) -> dict[str, object]:
        job = self.repository.enqueue_job({"status": "queued", **payload})
        return {"job": job}

    def retry_predownload(self, job_id: str) -> dict[str, object]:
        job = self.repository.retry_job(job_id)
        return {"job": job}

    def tick_predownload(self, job_id: str) -> dict[str, object]:
        job = self.repository.advance_job(job_id)
        return {"job": job, "progression": self.repository.progression_states()}

    def predownload_status(self) -> dict[str, object]:
        jobs = self.repository.list_jobs()
        return {"jobs": jobs, "count": len(jobs)}
