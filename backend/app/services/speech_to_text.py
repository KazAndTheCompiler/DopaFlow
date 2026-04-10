"""Shared speech-to-text helpers for journal dictation and voice commands."""

from __future__ import annotations

import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.services.upload_security import validate_upload

ALLOWED_AUDIO_SUFFIXES = {".wav", ".mp3", ".m4a", ".webm", ".ogg", ".mp4"}
ALLOWED_AUDIO_CONTENT_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp4",
    "audio/ogg",
    "audio/webm",
    "audio/webm;codecs=opus",
    "video/mp4",
    "video/webm",
    "video/webm;codecs=vp8,opus",
    "application/octet-stream",
}
DEFAULT_AUDIO_MAX_BYTES = 10 * 1024 * 1024


@dataclass(frozen=True)
class SpeechToTextResult:
    transcript: str


def _load_speech_recognition():
    try:
        import speech_recognition as sr
    except ImportError as exc:
        raise HTTPException(
            status_code=501, detail="Speech recognition not installed"
        ) from exc
    return sr


def transcribe_upload(file: UploadFile, *, lang: str = "en-US") -> SpeechToTextResult:
    """Validate an uploaded audio file and return a transcript."""

    data, suffix = validate_upload(
        file,
        kind="audio",
        allowed_suffixes=ALLOWED_AUDIO_SUFFIXES,
        allowed_content_types=ALLOWED_AUDIO_CONTENT_TYPES,
        default_max_bytes=DEFAULT_AUDIO_MAX_BYTES,
    )
    sr = _load_speech_recognition()

    recognizer = sr.Recognizer()
    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            input_path = Path(tmp_dir) / f"input{suffix or '.webm'}"
            wav_path = Path(tmp_dir) / "audio.wav"
            input_path.write_bytes(data)
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(input_path),
                    "-ar",
                    "16000",
                    "-ac",
                    "1",
                    "-f",
                    "wav",
                    str(wav_path),
                ],
                capture_output=True,
                check=True,
                timeout=30,
            )
            with sr.AudioFile(str(wav_path)) as source:
                audio = recognizer.record(source)
        return SpeechToTextResult(
            transcript=recognizer.recognize_google(audio, language=lang)
        )
    except sr.UnknownValueError:
        return SpeechToTextResult(transcript="")
    except subprocess.CalledProcessError as exc:
        raise HTTPException(status_code=422, detail="Audio conversion failed") from exc
    except sr.RequestError as exc:
        raise HTTPException(status_code=502, detail="Speech service error") from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(
            status_code=504, detail="Audio conversion timed out"
        ) from exc
