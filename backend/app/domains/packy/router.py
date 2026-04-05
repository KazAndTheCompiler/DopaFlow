# ENDPOINTS
#   POST   /packy/ask
#   POST   /packy/voice-command    <-- NEW: unified voice pipeline
#   GET    /packy/whisper
#   POST   /packy/lorebook
#   GET    /packy/momentum

"""API router for the Packy domain."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, UploadFile

from app.core.config import Settings, get_settings_dependency
from app.middleware.auth_scopes import require_scope
from app.domains.packy.repository import PackyRepository
from app.domains.packy.schemas import (
    MomentumScore,
    PackyAnswer,
    PackyAskRequest,
    PackyLorebookRequest,
    PackyVoiceCommand,
    PackyVoiceResponse,
    PackyWhisper,
)
from app.domains.packy.service import PackyService

router = APIRouter(prefix="/packy", tags=["packy"])


async def _svc(settings: Settings = Depends(get_settings_dependency)) -> PackyService:
    return PackyService(PackyRepository(settings.db_path))


# -----------------------------------------------------------------------
# Voice command endpoint (text transcript in → full voice response out)
# -----------------------------------------------------------------------


@router.post(
    "/voice-command",
    response_model=PackyVoiceResponse,
    dependencies=[Depends(require_scope("write:packy"))],
)
async def voice_command(
    payload: PackyVoiceCommand,
    settings: Settings = Depends(get_settings_dependency),
    svc: PackyService = Depends(_svc),
) -> PackyVoiceResponse:
    """
    Unified voice / natural-language command entry point.

    Accepts a text transcript (from browser SpeechRecognition or server STT)
    and returns:
      - intent classification + confidence
      - extracted entities
      - dry-run preview
      - execution result (if auto_execute=true)
      - conversational reply text
      - TTS text for speech synthesis
      - suggested follow-ups
    """
    payload.db_path = settings.db_path
    return svc.voice_command(payload)


@router.post(
    "/voice-command-audio",
    response_model=PackyVoiceResponse,
    dependencies=[Depends(require_scope("write:packy"))],
)
async def voice_command_audio(
    file: UploadFile = File(...),
    lang: str = Query(default="en-US"),
    auto_execute: bool = Query(default=False),
    settings: Settings = Depends(get_settings_dependency),
    svc: PackyService = Depends(_svc),
) -> PackyVoiceResponse:
    """
    Voice command from raw audio upload.

    Server-side STT → NLP → preview/execute.  Same response as /voice-command.
    """
    from app.services.speech_to_text import transcribe_upload

    transcript = transcribe_upload(file, lang=lang).transcript.strip()
    if not transcript:
        return PackyVoiceResponse(
            intent="unknown",
            confidence=0.0,
            reply_text="I didn't hear anything. Try again?",
            tts_text="I didn't catch that.",
            status="empty",
        )

    payload = PackyVoiceCommand(
        text=transcript,
        auto_execute=auto_execute,
        db_path=settings.db_path,
    )
    return svc.voice_command(payload)


# -----------------------------------------------------------------------
# Legacy ask endpoint
# -----------------------------------------------------------------------


@router.post("/ask", response_model=PackyAnswer, dependencies=[Depends(require_scope("write:packy"))])
async def ask_packy(payload: PackyAskRequest, svc: PackyService = Depends(_svc)) -> PackyAnswer:
    """Handle Packy's main ask endpoint."""
    return svc.ask(payload)


# -----------------------------------------------------------------------
# Whisper / lorebook / momentum
# -----------------------------------------------------------------------


@router.get("/whisper", response_model=PackyWhisper, dependencies=[Depends(require_scope("read:packy"))])
async def get_whisper(svc: PackyService = Depends(_svc)) -> PackyWhisper:
    """Return a Packy proactive tip."""
    return svc.whisper()


@router.post("/lorebook", response_model=dict[str, object], dependencies=[Depends(require_scope("write:packy"))])
async def update_lorebook(payload: PackyLorebookRequest, svc: PackyService = Depends(_svc)) -> dict[str, object]:
    """Push contextual lorebook updates into Packy."""
    return svc.lorebook(payload)


@router.get("/momentum", response_model=MomentumScore, dependencies=[Depends(require_scope("read:packy"))])
async def get_momentum(svc: PackyService = Depends(_svc)) -> MomentumScore:
    """Return the Packy momentum score."""
    return svc.momentum()
