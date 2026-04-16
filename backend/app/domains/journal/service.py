"""Business logic for the journal domain."""

from __future__ import annotations

import logging
import os
import re
import tempfile
import zipfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.core.config import default_backup_dir
from app.core.gamification_helpers import award as award_gamification
from app.domains.journal.repository import JournalRepository
from app.domains.journal.schemas import (
    JournalBackupStatus,
    JournalBackupTriggerResponse,
    JournalDeleteResponse,
    JournalEntryCreate,
    JournalEntryPatch,
    JournalEntryRead,
    JournalGraphEdge,
    JournalGraphNode,
    JournalGraphResponse,
    JournalPromptResponse,
    JournalSearchResult,
    JournalTemplate,
    JournalTemplateCreate,
    JournalTemplatePatch,
    JournalVersionDetail,
    JournalVersionSummary,
)

WIKILINK_PATTERN = re.compile(r"\[\[(\d{4}-\d{2}-\d{2})\]\]")
logger = logging.getLogger(__name__)

_PROMPT_BANK = [
    "What felt heavier than it looked today?",
    "What small thing helped you cope?",
    "What do you want tomorrow-you to remember?",
    "What are you carrying that is not yours to carry?",
    "Where did you spend energy well today?",
    "What needs a kinder story around it?",
    "What is unfinished but still okay?",
    "What felt more possible than expected?",
    "What did your body seem to need?",
    "What kept looping in your head today?",
    "What would make tonight gentler?",
    "What are you avoiding naming directly?",
    "What deserves credit even if it felt small?",
    "What would a softer plan for tomorrow look like?",
    "What friction showed up repeatedly?",
    "What actually mattered most today?",
    "Where did you feel most regulated?",
    "What would you like less of this week?",
    "What would you like more of this week?",
    "What felt unexpectedly good?",
    "What has been draining lately?",
    "What would help you recover next?",
    "What is one thing you can close today?",
    "What do you wish someone understood?",
    "What is asking for structure?",
    "What is asking for rest?",
    "What are you proud of, quietly?",
    "What would make the next hour easier?",
    "What deserves follow-up?",
    "What felt true today?",
]


def extract_wikilinks(body: str) -> list[str]:
    return WIKILINK_PATTERN.findall(body)


def _as_markdown_export(entries: list[JournalEntryRead]) -> str:
    parts = []
    for entry in sorted(entries, key=lambda e: e.date):
        parts.append(f"---\n## {entry.date}\n\n{entry.markdown_body.rstrip()}\n")
    return "".join(parts)


def _as_zip(entries: list[JournalEntryRead]) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    final_backup_path = tmp_path.with_name(f"{tmp_path.stem}-final.zip")
    renamed = False
    try:
        with zipfile.ZipFile(tmp_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            for entry in sorted(entries, key=lambda e: e.date):
                front = f"---\ndate: {entry.date}\ntags: {', '.join(entry.tags)}\nmood: {entry.emoji or ''}\n---\n\n"
                zf.writestr(f"{entry.date}.md", front + entry.markdown_body)
        os.replace(tmp_path, final_backup_path)
        renamed = True
        return final_backup_path.read_bytes()
    finally:
        if not renamed and tmp_path.exists():
            tmp_path.unlink()
        if renamed and final_backup_path.exists():
            final_backup_path.unlink()


class JournalService:
    """Coordinate journaling, wikilinks, tagging, analytics, and backup."""

    def __init__(
        self, repository: JournalRepository, backup_dir: str | Path | None = None
    ) -> None:
        self.repository = repository
        self.backup_dir = (
            Path(backup_dir) if backup_dir is not None else Path(default_backup_dir())
        )

    # ── entry CRUD ────────────────────────────────────────────────────────────

    def list_entries(
        self, tag: str | None = None, search: str | None = None
    ) -> list[JournalEntryRead]:
        return self.repository.list_entries(tag=tag, search=search)

    def get_entry(self, identifier: str) -> JournalEntryRead | None:
        return self.repository.get_entry(identifier)

    def save_entry(self, payload: JournalEntryCreate) -> JournalEntryRead:
        entry = self.repository.save_entry(payload)
        wikilinks = extract_wikilinks(payload.markdown_body)
        if wikilinks:
            self.repository.persist_links(entry.id, wikilinks)
        award_gamification("journal_entry", entry.id, logger=logger)
        return entry

    def patch_entry(
        self, entry_id: str, payload: JournalEntryPatch
    ) -> JournalEntryRead | None:
        """Partially update an entry. Raises ValueError('locked') if locked."""
        patch = payload.model_dump(exclude_unset=True)
        entry = self.repository.update_entry(entry_id, patch)
        if entry:
            wikilinks = extract_wikilinks(entry.markdown_body)
            if wikilinks:
                self.repository.persist_links(entry.id, wikilinks)
        return entry

    def lock_entry(self, entry_id: str, locked: bool) -> JournalEntryRead | None:
        return self.repository.set_locked(entry_id, locked)

    def delete_entry(self, identifier: str) -> JournalDeleteResponse:
        deleted = self.repository.delete_entry(identifier)
        return JournalDeleteResponse(deleted=deleted, identifier=identifier)

    # ── versions ──────────────────────────────────────────────────────────────

    def list_versions(self, identifier: str) -> list[JournalVersionSummary]:
        entry = self.repository.get_entry(identifier)
        if not entry:
            return []
        return self.repository.list_versions(entry.date)

    def get_version(
        self, identifier: str, version_number: int
    ) -> JournalVersionDetail | None:
        entry = self.repository.get_entry(identifier)
        if not entry:
            return None
        return self.repository.get_version(entry.date, version_number)

    # ── graph / backlinks ─────────────────────────────────────────────────────

    def get_backlinks(self, identifier: str) -> list[str]:
        return self.repository.get_backlinks(identifier)

    def get_graph_data(self) -> JournalGraphResponse:
        graph = self.repository.get_graph_data()
        return JournalGraphResponse(
            nodes=[JournalGraphNode(**node) for node in graph["nodes"]],
            edges=[JournalGraphEdge(**edge) for edge in graph["edges"]],
        )

    # ── analytics ─────────────────────────────────────────────────────────────

    def get_analytics_summary(self, days: int = 90) -> dict[str, object]:
        return self.repository.get_analytics_summary(days)

    def get_heatmap(self, year: int) -> dict[str, int]:
        return self.repository.get_heatmap(year)

    def get_auto_tag_stats(self) -> dict[str, int]:
        return self.repository.get_auto_tag_stats()

    def search_rich(
        self, q: str = "", mood: str | None = None, limit: int = 50
    ) -> list[JournalSearchResult]:
        return self.repository.search_rich(q=q, mood=mood, limit=limit)

    # ── prompts ───────────────────────────────────────────────────────────────

    def get_prompt(self, for_date: str) -> JournalPromptResponse:
        recent = self.repository.list_entries()[:7]
        prompts: list[str] = []

        # context-sensitive additions
        rough_set = {"rough", "😞", "😓", "😢", "😩"}
        emojis = [(e.emoji or "").strip() for e in recent]
        if len(emojis) >= 2 and sum(1 for e in emojis[:3] if e in rough_set) >= 2:
            prompts.append(
                "What would self-compassion sound like if you wrote to yourself as a friend?"
            )

        recent_tags = {t.lower() for e in recent for t in e.tags}
        if "work" in recent_tags or "stress" in recent_tags:
            prompts.append("What would help you decompress from work or stress today?")

        try:
            parsed = datetime.strptime(for_date, "%Y-%m-%d").date()
            if parsed.weekday() == 0:
                prompts.append(
                    "What does a realistic, humane week-ahead plan look like for you?"
                )
            yesterday = (parsed - timedelta(days=1)).isoformat()
            if all(e.date != yesterday for e in recent):
                prompts.append(
                    "You missed yesterday. What happened in the gap, and what matters from it now?"
                )
        except ValueError:
            pass

        for candidate in _PROMPT_BANK:
            if candidate not in prompts:
                prompts.append(candidate)
            if len(prompts) == 3:
                break

        return JournalPromptResponse(prompts=prompts[:3])

    # ── export ────────────────────────────────────────────────────────────────

    def export_range(
        self, from_date: str | None, to_date: str | None, fmt: str = "markdown"
    ) -> object:
        """Return entries as markdown text, JSON list, or zip bytes."""
        today = datetime.now(UTC).date()
        end = today if not to_date else datetime.strptime(to_date, "%Y-%m-%d").date()
        start = (
            (end - timedelta(days=29))
            if not from_date
            else datetime.strptime(from_date, "%Y-%m-%d").date()
        )
        all_entries = self.repository.list_entries()
        entries = [
            e
            for e in all_entries
            if e.date
            and datetime.strptime(e.date, "%Y-%m-%d").date() >= start
            and datetime.strptime(e.date, "%Y-%m-%d").date() <= end
        ]
        entries.sort(key=lambda e: e.date)
        if fmt == "json":
            return [e.model_dump() for e in entries]
        if fmt == "zip":
            return _as_zip(entries)
        return _as_markdown_export(entries)

    def export_zip(self, from_date: str, to_date: str) -> bytes:
        start = datetime.strptime(from_date, "%Y-%m-%d").date()
        end = datetime.strptime(to_date, "%Y-%m-%d").date()
        all_entries = self.repository.list_entries()
        entries = [
            e
            for e in all_entries
            if e.date
            and datetime.strptime(e.date, "%Y-%m-%d").date() >= start
            and datetime.strptime(e.date, "%Y-%m-%d").date() <= end
        ]
        return _as_zip(entries)

    # ── templates ─────────────────────────────────────────────────────────────

    def list_templates(self) -> list[JournalTemplate]:
        return self.repository.list_templates()

    def get_template(self, template_id: str) -> JournalTemplate | None:
        return self.repository.get_template(template_id)

    def create_template(self, payload: JournalTemplateCreate) -> JournalTemplate:
        return self.repository.create_template(payload.name, payload.body, payload.tags)

    def update_template(
        self, template_id: str, payload: JournalTemplatePatch
    ) -> JournalTemplate | None:
        patch = payload.model_dump(exclude_unset=True)
        return self.repository.update_template(template_id, patch)

    def delete_template(self, template_id: str) -> bool:
        return self.repository.delete_template(template_id)

    # ── backup ────────────────────────────────────────────────────────────────

    def get_backup_status(self) -> JournalBackupStatus:
        return self.repository.backup_status()

    def _database_integrity_ok(self) -> bool:
        return self.repository.check_integrity()

    def trigger_backup(self, date: str | None = None) -> JournalBackupTriggerResponse:
        target_date = date or datetime.now(UTC).date().isoformat()
        entry = self.repository.get_entry(target_date)
        if not entry:
            return JournalBackupTriggerResponse(
                message=f"No entry for {target_date} — backup skipped",
                backed_up_date=None,
            )
        if not self._database_integrity_ok():
            logger.warning(
                "Journal backup skipped because database integrity_check failed"
            )
            return JournalBackupTriggerResponse(
                message="Database integrity check failed — backup skipped",
                backed_up_date=None,
                status="skipped_integrity_fail",
            )
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        backup_file = self.backup_dir / f"{target_date}.md"
        front_matter = f"---\ndate: {target_date}\ntags: {', '.join(entry.tags)}\nversion: {entry.version}\n---\n\n"
        backup_file.write_text(front_matter + entry.markdown_body, encoding="utf-8")
        return JournalBackupTriggerResponse(
            message=f"Backed up {target_date}", backed_up_date=target_date
        )

    def export_today(self) -> dict:
        today = datetime.now(UTC).date().isoformat()
        entry = self.repository.get_entry(today)
        if not entry:
            return {"path": "", "entry_count": 0}
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        backup_file = self.backup_dir / f"{today}.md"
        front_matter = f"---\ndate: {today}\nmood: {entry.emoji or ''}\ntags: {', '.join(entry.tags)}\n---\n\n"
        backup_file.write_text(front_matter + entry.markdown_body, encoding="utf-8")
        return {"path": str(backup_file), "entry_count": 1}
