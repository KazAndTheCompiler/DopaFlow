"""
Business logic for the Packy assistant domain.

Packy is the voice orchestrator for DopaFlow.  All voice and natural-language
input routes through Packy, which classifies intent, generates a preview,
executes actions, and returns a conversational reply with TTS text.
"""

from __future__ import annotations

from typing import Literal

from app.core.vocabulary import INTENT_TO_ACTION
from app.domains.commands.service import CommandService
from app.domains.packy.repository import PackyRepository
from app.domains.packy.schemas import (
    MomentumScore,
    PackyAnswer,
    PackyAskRequest,
    PackyLorebookRequest,
    PackyLorebookResponse,
    PackyVoiceCommand,
    PackyVoiceResponse,
    PackyWhisper,
)
from app.services import nlp


class PackyService:
    """
    Packy - ADHD-aware productivity assistant.

    Design rules:
    - Neutral, helpful, never grumpy or sarcastic
    - Responses are short and always actionable
    - Uses lorebook context to personalise without overwhelming
    - Voice commands flow through here
    """

    def __init__(self, repository: PackyRepository) -> None:
        self.repository = repository

    # ------------------------------------------------------------------
    # Voice command pipeline (NEW — the main voice entry point)
    # ------------------------------------------------------------------

    def voice_command(self, payload: PackyVoiceCommand) -> PackyVoiceResponse:
        """
        Process a voice or natural-language command end-to-end.

        Flow:
          1. Classify intent via NLP engine (no prefix required)
          2. Generate a preview of what would happen
          3. If auto_execute: run the command, return result + TTS reply
          4. Otherwise: return preview for the frontend to show

        Returns PackyVoiceResponse with:
          - intent / confidence / entities
          - preview dict (dry-run)
          - execution result (if auto_execute)
          - reply_text (conversational)
          - tts_text (for speech synthesis)
          - follow_ups (suggested next actions)
          - mode (preview | executed | clarification | conversational | empty)
        """
        text = (payload.text or "").strip()
        if not text:
            return PackyVoiceResponse(
                intent="unknown",
                confidence=0.0,
                reply_text="I didn't hear anything. Try again?",
                tts_text="I didn't catch that.",
                status="empty",
                mode="empty",
            )

        # 1. Classify
        nlp_result = nlp.classify(text, context=payload.context)

        # 2. Preview
        preview = CommandService.preview(text, payload.db_path)

        # 3. Determine response mode from intent
        conversational_intents = {"greeting", "help", "unknown"}
        if nlp_result.intent in conversational_intents:
            initial_mode: Literal[
                "preview", "executed", "clarification", "conversational", "empty"
            ] = "conversational"
        elif preview.get("status") != "ok":
            initial_mode = "clarification"
        else:
            initial_mode = "preview"

        # 4. Build response
        response = PackyVoiceResponse(
            intent=nlp_result.intent,
            confidence=nlp_result.confidence,
            entities=nlp_result.entities,
            preview=preview,
            reply_text=nlp_result.tts_response,
            tts_text=nlp_result.tts_response,
            follow_ups=nlp_result.follow_ups,
            status=str(preview.get("status", "ok")),
            mode=initial_mode,
        )

        if response.status != "ok":
            preview_message = str(preview.get("message") or "").strip()
            if preview_message:
                response.reply_text = preview_message
                response.tts_text = preview_message

        # 5. Execute if requested and the preview says it's actionable
        if payload.auto_execute and preview.get("would_execute"):
            db_path = payload.db_path or ""
            if not db_path:
                # No database path configured — return error response
                response.status = "error"
                response.reply_text = "Internal error: database not configured."
                response.tts_text = "Something went wrong. Try again."
                response.mode = "clarification"
            else:
                result = CommandService.execute(
                    db_path, text, confirm=True, source="voice"
                )
                response.execution_result = result
                response.status = str(result.get("status", "executed"))
                response.mode = "executed"
                # Update reply from execution result if available
                if result.get("reply"):
                    response.reply_text = result["reply"]
                    response.tts_text = result["reply"]
                # Merge follow-ups from execution
                if result.get("follow_ups"):
                    response.follow_ups = result["follow_ups"]

        return response

    # ------------------------------------------------------------------
    # Legacy ask endpoint (unchanged behavior)
    # ------------------------------------------------------------------

    def ask(self, payload: PackyAskRequest) -> PackyAnswer:
        """Parse NLP intent from the request and return a short actionable reply."""

        nlp_result = nlp.classify(payload.text, context=payload.context)
        intent = nlp_result.intent

        # Context-biased nudge: if intent is unknown and user is on a surface
        if intent == "unknown" and payload.context:
            route = str(payload.context.get("route", ""))
            complements: dict[str, tuple[str, str]] = {
                "tasks": (
                    "open-habits",
                    "Habits pair well with tasks. Log one check-in?",
                ),
                "habits": ("start-focus", "Focus time locks in what habits start."),
                "focus": ("open-review", "Post-focus review cements what you learned."),
                "review": ("open-journal", "Write a short note on what you reviewed."),
                "journal": (
                    "open-today",
                    "Good reflection. What's the next concrete action?",
                ),
                "calendar": (
                    "open-tasks",
                    "Check your task list against the schedule.",
                ),
                "nutrition": ("open-today", "Fuelled up — what's next on the list?"),
            }
            for surface, (action, reply) in complements.items():
                if surface in route:
                    return PackyAnswer(
                        intent="context_nudge",
                        extracted_data={"route": route},
                        reply_text=reply,
                        suggested_action=action,
                    )

        # If NLP found a real intent, use its reply
        if intent not in ("unknown", "greeting", "help"):
            return PackyAnswer(
                intent=intent,
                extracted_data=nlp_result.entities,
                reply_text=nlp_result.tts_response,
                suggested_action=self._intent_to_action(intent),
            )

        # Greeting / help / unknown
        replies = {
            "greeting": (nlp_result.tts_response, "open-command-bar"),
            "help": (nlp_result.tts_response, "open-command-bar"),
            "unknown": ("I can help best with one next action.", "open-command-bar"),
        }
        reply_text, suggested_action = replies.get(intent, replies["unknown"])
        whisper = self.repository.whisper()
        if whisper.text.lower().startswith("achievement"):
            reply_text = f"{reply_text} {whisper.text}"
        return PackyAnswer(
            intent=intent,
            extracted_data=nlp_result.entities,
            reply_text=reply_text,
            suggested_action=suggested_action,
        )

    @staticmethod
    def _intent_to_action(intent: str) -> str:
        return INTENT_TO_ACTION.get(intent, "open-command-bar")

    # ------------------------------------------------------------------
    # Whisper / lorebook / momentum (unchanged)
    # ------------------------------------------------------------------

    def whisper(self) -> PackyWhisper:
        """Return a proactive nudge from the repository (SQLite-backed lorebook)."""
        return self.repository.whisper()

    def lorebook(self, payload: PackyLorebookRequest) -> PackyLorebookResponse:
        """Persist lorebook context and return acknowledgement."""
        return self.repository.update_lorebook(payload)

    def momentum(self) -> MomentumScore:
        """Return the current momentum score from the repository."""
        return self.repository.momentum()
