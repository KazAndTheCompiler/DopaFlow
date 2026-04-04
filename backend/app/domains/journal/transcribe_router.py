# ENDPOINTS
#   POST   /journal/transcribe

"""Speech-to-text upload route for journal dictation."""

from __future__ import annotations

from fastapi import APIRouter, File, Query, UploadFile
from fastapi.responses import JSONResponse

from app.services.speech_to_text import transcribe_upload

router = APIRouter(tags=["journal"])


@router.post("/journal/transcribe")
async def transcribe_audio(file: UploadFile = File(...), lang: str = Query("en-US")) -> JSONResponse:
    """Convert uploaded audio to text via Google free speech API."""
    result = transcribe_upload(file, lang=lang)
    return JSONResponse({"transcript": result.transcript})
