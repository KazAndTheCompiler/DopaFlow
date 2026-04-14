"""Nightly journal backup scheduler."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from pathlib import Path

from app.core.config import Settings
from app.domains.journal.repository import JournalRepository


class JournalBackupScheduler:
    """Run nightly backups for missed and current journal days."""

    def __init__(self) -> None:
        self.running = False
        self.settings: Settings | None = None
        self.backup_dir: Path | None = None

    def configure(self, *, settings: Settings, backup_dir: str | Path) -> None:
        self.settings = settings
        self.backup_dir = Path(backup_dir)

    async def backup_missed_days(self) -> None:
        """Back up any missing days based on existing markdown exports."""

        if self.settings is None or self.backup_dir is None:
            raise RuntimeError("JournalBackupScheduler is not configured")

        repo = JournalRepository(self.settings)
        backup_dir = self.backup_dir
        backup_dir.mkdir(parents=True, exist_ok=True)

        last_backup_date = None
        files = sorted(backup_dir.glob("*.md"))
        if files:
            try:
                last_backup_date = datetime.strptime(files[-1].stem, "%Y-%m-%d").date()
            except ValueError:
                last_backup_date = None

        today = datetime.now().date()
        current = last_backup_date or (today - timedelta(days=1))

        while current <= today:
            entry = repo.get_entry(current.isoformat())
            if entry and entry.markdown_body:
                backup_file = backup_dir / f"{current.isoformat()}.md"
                front_matter = (
                    f"---\n"
                    f"date: {current.isoformat()}\n"
                    f"tags: {', '.join(entry.tags)}\n"
                    f"version: {entry.version}\n"
                    f"---\n\n"
                )
                backup_file.write_text(
                    front_matter + entry.markdown_body, encoding="utf-8"
                )
            current += timedelta(days=1)

    async def start(self) -> None:
        """Start the long-running nightly backup loop."""

        if self.running:
            return

        self.running = True
        await self.backup_missed_days()

        while self.running:
            now = datetime.now()
            next_backup = (now + timedelta(days=1)).replace(
                hour=23, minute=59, second=0, microsecond=0
            )
            await asyncio.sleep((next_backup - now).total_seconds())
            if self.running:
                await self.backup_missed_days()

    def stop(self) -> None:
        """Stop the loop on shutdown."""

        self.running = False
