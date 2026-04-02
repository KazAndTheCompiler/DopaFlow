"""Motivation quote and optional TTS helpers."""

from __future__ import annotations

import random
import subprocess

from app.domains.motivation.repository import MotivationRepository


class MotivationService:
    def __init__(self, repository: MotivationRepository | None = None) -> None:
        self.repository = repository or MotivationRepository()

    def random_quote(self) -> str:
        quotes = self.repository.list_quotes()
        return random.choice(quotes) if quotes else "Keep moving."

    def speak_quote(self) -> dict[str, object]:
        quote = self.random_quote()
        try:
            subprocess.Popen(["say", quote])
            return {"triggered": True, "quote": quote}
        except FileNotFoundError:
            return {"triggered": False, "quote": quote, "error": "TTS command not available"}
