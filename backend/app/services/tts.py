"""Cross-platform TTS - espeak-ng (Linux) · say (macOS) · PowerShell (Windows)."""

from __future__ import annotations

import logging
import os
import platform
import shutil
import subprocess
import threading

logger = logging.getLogger("dopaflow.tts")


def _disabled() -> bool:
    return os.getenv("DOPAFLOW_DISABLE_LOCAL_AUDIO", "0") == "1"


def _speak_linux(text: str) -> None:
    cmd = shutil.which("espeak-ng") or shutil.which("espeak")
    if not cmd:
        logger.warning("[tts] espeak-ng not found - sudo apt install espeak-ng")
        return
    subprocess.run([cmd, text], timeout=30, check=False)


def _speak_macos(text: str) -> None:
    subprocess.run(["say", text], timeout=30, check=False)


def _speak_windows(text: str) -> None:
    safe = text.replace('"', "'")
    script = (
        "Add-Type -AssemblyName System.Speech; "
        f'(New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak("{safe}")'
    )
    subprocess.run(["powershell", "-Command", script], timeout=30, check=False)


def speak(text: str) -> None:
    """Speak text in a background daemon thread - never blocks the caller."""
    if not text or not text.strip() or _disabled():
        return

    def _run() -> None:
        try:
            system = platform.system()
            if system == "Linux":
                _speak_linux(text)
            elif system == "Darwin":
                _speak_macos(text)
            elif system == "Windows":
                _speak_windows(text)
        except subprocess.TimeoutExpired:
            logger.warning("[tts] speech timed out")
        except Exception as exc:
            logger.error("[tts] error: %s", exc)

    threading.Thread(target=_run, daemon=True).start()
