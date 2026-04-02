# ENDPOINTS
#   POST   /journal/transcribe

"""Speech-to-text upload route for journal dictation."""

from __future__ import annotations

import os
import subprocess
import tempfile

from fastapi import APIRouter, File, Query, UploadFile
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from app.services.upload_security import validate_upload

router = APIRouter(tags=["journal"])


@router.post("/journal/transcribe")
async def transcribe_audio(file: UploadFile = File(...), lang: str = Query("en-US")) -> JSONResponse:
    """Convert uploaded audio to text via Google free speech API."""
    try:
        import speech_recognition as sr
    except ImportError as exc:
        raise HTTPException(status_code=501, detail="Speech recognition not installed") from exc

    data, suffix = validate_upload(
        file,
        allowed_suffixes={".wav", ".mp3", ".m4a", ".webm", ".ogg", ".mp4"},
        default_max_bytes=10 * 1024 * 1024,
    )

    recognizer = sr.Recognizer()
    try:
        with tempfile.TemporaryDirectory() as tmp:
            in_path = os.path.join(tmp, "input" + suffix)
            wav_path = os.path.join(tmp, "audio.wav")
            with open(in_path, "wb") as handle:
                handle.write(data)
            subprocess.run(
                ["ffmpeg", "-y", "-i", in_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
                capture_output=True,
                check=True,
                timeout=30,
            )
            with sr.AudioFile(wav_path) as source:
                audio = recognizer.record(source)
        text = recognizer.recognize_google(audio, language=lang)
        return JSONResponse({"transcript": text})
    except sr.UnknownValueError:
        return JSONResponse({"transcript": ""})
    except subprocess.CalledProcessError:
        return JSONResponse({"error": "audio_conversion_failed"}, status_code=422)
    except sr.RequestError:
        return JSONResponse({"error": "speech_service_error"}, status_code=503)
    except subprocess.TimeoutExpired:
        return JSONResponse({"error": "timeout"}, status_code=504)
