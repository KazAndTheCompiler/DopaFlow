"""Business logic for the Packy assistant domain."""

from __future__ import annotations

from app.domains.packy.repository import PackyRepository
from app.domains.packy.schemas import MomentumScore, PackyAnswer, PackyAskRequest, PackyLorebookRequest, PackyWhisper


class PackyService:
    """
    Packy - ADHD-aware productivity assistant.

    Design rules:
    - Neutral, helpful, never grumpy or sarcastic
    - Responses are short
    - Always actionable
    - Uses lorebook context to personalize without overwhelming
    """

    def __init__(self, repository: PackyRepository) -> None:
        self.repository = repository

    def _detect_intent(self, text: str) -> tuple[str, dict[str, object]]:
        """Detect a small set of productivity intents from natural language."""

        lowered = text.lower()
        if "focus" in lowered:
            return "focus_start", {}
        if "habit" in lowered or "check in" in lowered:
            return "habit_check", {}
        if "review" in lowered or "flashcard" in lowered:
            return "review_start", {}
        if "journal" in lowered or "write" in lowered:
            return "journal_write", {}
        if "mood" in lowered:
            return "mood_log", {}
        if "schedule" in lowered or "today" in lowered:
            return "schedule_today", {}
        if "find" in lowered or "search" in lowered:
            return "search", {"query": text}
        if any(token in lowered for token in {"add", "task", "todo"}):
            return "task_add", {"title": text}
        return "unknown", {}

    def ask(self, payload: PackyAskRequest) -> PackyAnswer:
        """Parse NLP intent from the request and return a short actionable reply."""

        intent, extracted_data = self._detect_intent(payload.text)

        # Context-biased nudge: if intent is unknown and user is already on a surface, suggest complement
        if intent == "unknown" and payload.context:
            route = str(payload.context.get("route", ""))
            complements: dict[str, tuple[str, str]] = {
                "tasks": ("open-habits", "Habits pair well with tasks. Log one check-in?"),
                "habits": ("start-focus", "Focus time locks in what habits start."),
                "focus": ("open-review", "Post-focus review cements what you learned."),
                "review": ("open-journal", "Write a short note on what you reviewed."),
                "journal": ("open-today", "Good reflection. What's the next concrete action?"),
                "calendar": ("open-tasks", "Check your task list against the schedule."),
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

        replies = {
            "task_add": ("I can turn that into one task.", "open-task-create"),
            "habit_check": ("Let's log one habit check-in now.", "open-habits"),
            "focus_start": ("Start one 25-minute focus block.", "start-focus"),
            "review_start": ("A short review session would fit well here.", "open-review"),
            "mood_log": ("Log the mood first, then keep moving.", "open-journal"),
            "journal_write": ("Write two lines, not a perfect page.", "open-journal"),
            "search": ("I'll narrow that down to one result set.", "open-search"),
            "schedule_today": ("Pick one must-do block for today.", "open-today"),
            "unknown": ("I can help best with one next action.", "open-command-bar"),
        }
        reply_text, suggested_action = replies[intent]
        whisper = self.repository.whisper()
        if whisper.text.startswith("Achievement"):
            reply_text = f"{reply_text} {whisper.text}"
        return PackyAnswer(
            intent=intent,
            extracted_data=extracted_data,
            reply_text=reply_text,
            suggested_action=suggested_action,
        )

    def whisper(self) -> PackyWhisper:
        """Return a proactive nudge from the repository (SQLite-backed lorebook)."""

        return self.repository.whisper()

    def lorebook(self, payload: PackyLorebookRequest) -> dict[str, object]:
        """Persist lorebook context and return acknowledgement."""

        return self.repository.update_lorebook(payload)

    def momentum(self) -> MomentumScore:
        """Return the current momentum score from the repository."""

        return self.repository.momentum()
