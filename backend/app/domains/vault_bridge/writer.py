"""Write DopaFlow entities to Obsidian-compatible Markdown files."""

from __future__ import annotations

import hashlib
from pathlib import Path

from app.domains.journal.schemas import JournalEntryRead
from app.domains.vault_bridge.file_names import journal_note_path
from app.domains.vault_bridge.frontmatter import serialize_frontmatter
from app.domains.vault_bridge.schemas import VaultConfig


def _hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


def render_journal_note(entry: JournalEntryRead) -> str:
    """Render a JournalEntry as an Obsidian-compatible Markdown string."""
    fields: dict = {
        "dopaflow_type": "journal",
        "dopaflow_id": entry.id,
        "date": entry.date,
    }
    if entry.emoji:
        fields["mood"] = entry.emoji
    if entry.tags:
        fields["tags"] = entry.tags

    fm = serialize_frontmatter(fields)
    body = entry.markdown_body.strip()
    return fm + "\n\n" + body + "\n"


def write_journal_entry(
    entry: JournalEntryRead,
    config: VaultConfig,
) -> tuple[str, str, str | None]:
    """Write a journal entry to the vault.

    Returns (file_path_relative, content_hash, previous_content_or_None).
    Raises FileNotFoundError if vault root does not exist.
    Raises ValueError if vault_path is not configured.
    Raises ValueError if the resolved path escapes the vault root.
    """
    if not config.vault_path:
        raise ValueError("vault_path is not configured")

    vault_root = Path(config.vault_path).resolve()
    if not vault_root.exists():
        raise FileNotFoundError(f"Vault path does not exist: {config.vault_path}")

    rel_path = f"{config.daily_note_folder}/{Path(journal_note_path(entry.date)).name}"
    abs_path = (vault_root / rel_path).resolve()
    if not str(abs_path).startswith(str(vault_root)):
        raise ValueError("journal entry path escapes vault root")
    abs_path.parent.mkdir(parents=True, exist_ok=True)

    # Snapshot existing content for rollback
    previous: str | None = None
    if abs_path.exists():
        previous = abs_path.read_text(encoding="utf-8")

    content = render_journal_note(entry)
    abs_path.write_text(content, encoding="utf-8")

    return rel_path, _hash(content), previous
