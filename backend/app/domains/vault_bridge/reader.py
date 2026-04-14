"""Read Obsidian-compatible Markdown files and parse them into DopaFlow entity candidates."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

from app.domains.vault_bridge.frontmatter import deserialize_frontmatter
from app.domains.vault_bridge.schemas import VaultConfig


def _hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


@dataclass
class JournalCandidate:
    """Parsed data from a vault journal note, not yet committed to DB."""

    file_path: str  # relative to vault root
    file_hash: str
    dopaflow_id: str | None
    date: str | None
    emoji: str | None
    tags: list[str]
    markdown_body: str


def parse_journal_note(abs_path: Path, vault_root: Path) -> JournalCandidate:
    """Parse a Markdown file into a JournalCandidate."""
    content = abs_path.read_text(encoding="utf-8")
    fields, body = deserialize_frontmatter(content)

    tags = fields.get("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]

    return JournalCandidate(
        file_path=str(abs_path.relative_to(vault_root)),
        file_hash=_hash(content),
        dopaflow_id=fields.get("dopaflow_id"),
        date=fields.get("date"),
        emoji=fields.get("mood") or fields.get("emoji"),
        tags=tags,
        markdown_body=body.strip(),
    )


def scan_journal_notes(config: VaultConfig) -> list[JournalCandidate]:
    """Scan the vault daily notes folder and return parsed candidates.

    Only files that look like YYYY-MM-DD.md are included.
    """
    if not config.vault_path:
        return []

    vault_root = Path(config.vault_path)
    daily_dir = vault_root / config.daily_note_folder
    if not daily_dir.exists():
        return []

    candidates = []
    for md_file in sorted(daily_dir.glob("*.md")):
        # Only process date-named files
        stem = md_file.stem
        if len(stem) == 10 and stem[4] == "-" and stem[7] == "-":
            try:
                candidate = parse_journal_note(md_file, vault_root)
                if candidate.date is None:
                    candidate.date = stem  # fallback: use filename as date
                candidates.append(candidate)
            except Exception:
                pass  # skip unreadable files without crashing the scan

    return candidates
