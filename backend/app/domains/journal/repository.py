"""Persistence helpers for the journal domain."""

from __future__ import annotations

import json
import logging
import re
import uuid
from collections import Counter
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from app.core.database import get_db, tx
from app.core.id_gen import journal_id
from app.domains.journal.schemas import (
    JournalBackupStatus,
    JournalEntryCreate,
    JournalEntryRead,
    JournalSearchResult,
    JournalTemplate,
    JournalVersionDetail,
    JournalVersionSummary,
)

logger = logging.getLogger(__name__)

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_WIKILINK_RE = re.compile(r"\[\[(\d{4}-\d{2}-\d{2})\]\]")

_AUTO_TAG_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(anxious|anxiety|panic|overwhelm)\b", re.I), "anxiety"),
    (re.compile(r"\b(grateful|gratitude|thankful)\b", re.I), "gratitude"),
    (re.compile(r"\b(focus|pomodoro|deep.work)\b", re.I), "focus"),
    (re.compile(r"\b(exercise|workout|gym|run|walk)\b", re.I), "exercise"),
    (re.compile(r"\b(sleep|insomnia|tired|exhausted|fatigue)\b", re.I), "sleep"),
    (re.compile(r"\b(work|project|meeting|deadline|task)\b", re.I), "work"),
    (re.compile(r"\b(family|friend|social|relationship)\b", re.I), "social"),
    (re.compile(r"\b(meditat|mindful|breath)\b", re.I), "mindfulness"),
    (re.compile(r"\b(pain|headache|sick|ill|health)\b", re.I), "health"),
    (re.compile(r"\b(mood|emotion|feeling|sad|happy|anger|joy)\b", re.I), "emotion"),
]


def _auto_tags_for_body(body: str) -> list[str]:
    found = []
    seen: set[str] = set()
    for pattern, tag in _AUTO_TAG_RULES:
        if tag not in seen and pattern.search(body or ""):
            found.append(tag)
            seen.add(tag)
    return found


def _word_count(text: str) -> int:
    return len((text or "").split())


def _strip_markdown(text: str) -> str:
    text = re.sub(r"`([^`]*)`", r"\1", text or "")
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"^[#>*\-]+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"[*_~]", "", text)
    return text.strip()


def _snippet(body: str, query: str) -> str:
    plain = _strip_markdown(body)
    if not query:
        return plain[:100]
    m = re.search(re.escape(query), plain, re.IGNORECASE)
    if not m:
        return plain[:100]
    start = max(0, m.start() - 50)
    end = min(len(plain), m.end() + 50)
    chunk = plain[start:end]
    ls = m.start() - start
    le = m.end() - start
    return f"{chunk[:ls]}<mark>{chunk[ls:le]}</mark>{chunk[le:]}"


def _row_to_entry(row: object) -> JournalEntryRead:
    tags: list[str] = json.loads(row["tags_json"] or "[]")  # type: ignore[index]
    auto_tags: list[str] = []
    try:
        auto_tags = json.loads(row["auto_tags_json"] or "[]")  # type: ignore[index]
    except Exception:
        logger.exception("Failed to parse auto_tags_json: %s", row.get("auto_tags_json"))
    return JournalEntryRead(
        id=row["id"],  # type: ignore[index]
        markdown_body=row["markdown_body"],  # type: ignore[index]
        emoji=row["emoji"],  # type: ignore[index]
        date=row["entry_date"],  # type: ignore[index]
        tags=tags,
        auto_tags=auto_tags,
        version=int(row["version"]),  # type: ignore[index]
        locked=bool(row["locked"]),  # type: ignore[index]
    )


def _row_to_template(row: object) -> JournalTemplate:
    tags: list[str] = json.loads(row["tags"] or "[]")  # type: ignore[index]
    return JournalTemplate(
        id=row["id"],  # type: ignore[index]
        name=row["name"],  # type: ignore[index]
        body=row["body"],  # type: ignore[index]
        tags=tags,
        created_at=row["created_at"],  # type: ignore[index]
    )


class JournalRepository:
    """Read and write journal entries, backlinks, backup metadata, versions, and templates."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    # ── entries ───────────────────────────────────────────────────────────────

    def list_entries(self, tag: str | None = None, search: str | None = None) -> list[JournalEntryRead]:
        with get_db(self.db_path) as conn:
            query = "SELECT * FROM journal_entries WHERE deleted_at IS NULL"
            params: list[object] = []
            if tag:
                query += " AND tags_json LIKE ?"
                params.append(f'%"{tag}"%')
            if search:
                query += " AND markdown_body LIKE ?"
                params.append(f"%{search}%")
            query += " ORDER BY entry_date DESC"
            rows = conn.execute(query, params).fetchall()
            return [_row_to_entry(row) for row in rows]

    def get_entry(self, identifier: str) -> JournalEntryRead | None:
        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM journal_entries WHERE (id = ? OR entry_date = ?) AND deleted_at IS NULL",
                (identifier, identifier),
            ).fetchone()
            return _row_to_entry(row) if row else None

    def save_entry(self, payload: JournalEntryCreate) -> JournalEntryRead:
        tags_json = json.dumps(payload.tags)
        auto_tags_json = json.dumps(_auto_tags_for_body(payload.markdown_body))
        with tx(self.db_path) as conn:
            new_id = journal_id()
            conn.execute(
                """
                INSERT INTO journal_entries (id, markdown_body, emoji, entry_date, tags_json, auto_tags_json)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(entry_date) DO UPDATE SET
                    markdown_body  = excluded.markdown_body,
                    emoji          = excluded.emoji,
                    tags_json      = excluded.tags_json,
                    auto_tags_json = excluded.auto_tags_json,
                    version        = version + 1,
                    updated_at     = CURRENT_TIMESTAMP
                """,
                (new_id, payload.markdown_body, payload.emoji, payload.date, tags_json, auto_tags_json),
            )
            row = conn.execute(
                "SELECT * FROM journal_entries WHERE entry_date = ? AND deleted_at IS NULL",
                (payload.date,),
            ).fetchone()
            entry = _row_to_entry(row)
        self._save_version(payload.date, payload.markdown_body)
        return entry

    def update_entry(self, entry_id: str, patch: dict) -> JournalEntryRead | None:
        """Apply a partial update. Raises ValueError('locked') if entry is locked."""
        existing = self.get_entry(entry_id)
        if not existing:
            return None
        if existing.locked:
            raise ValueError("locked")
        body = patch.get("markdown_body", existing.markdown_body)
        emoji = patch.get("emoji", existing.emoji)
        tags = patch.get("tags", existing.tags)
        tags_json = json.dumps(tags)
        auto_tags_json = json.dumps(_auto_tags_for_body(body))
        with tx(self.db_path) as conn:
            conn.execute(
                """
                UPDATE journal_entries
                SET markdown_body  = ?,
                    emoji          = ?,
                    tags_json      = ?,
                    auto_tags_json = ?,
                    version        = version + 1,
                    updated_at     = CURRENT_TIMESTAMP
                WHERE id = ? AND deleted_at IS NULL
                """,
                (body, emoji, tags_json, auto_tags_json, entry_id),
            )
        links = _WIKILINK_RE.findall(body)
        if links:
            self.persist_links(entry_id, links)
        self._save_version(existing.date, body)
        return self.get_entry(entry_id)

    def set_locked(self, entry_id: str, locked: bool) -> JournalEntryRead | None:
        with tx(self.db_path) as conn:
            conn.execute(
                "UPDATE journal_entries SET locked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
                (1 if locked else 0, entry_id),
            )
        return self.get_entry(entry_id)

    def delete_entry(self, identifier: str) -> bool:
        with tx(self.db_path) as conn:
            result = conn.execute(
                "UPDATE journal_entries SET deleted_at = CURRENT_TIMESTAMP WHERE (id = ? OR entry_date = ?) AND deleted_at IS NULL",
                (identifier, identifier),
            )
            return result.rowcount > 0

    # ── versions ──────────────────────────────────────────────────────────────

    def _save_version(self, entry_date: str, body: str) -> None:
        try:
            with tx(self.db_path) as conn:
                row = conn.execute(
                    "SELECT COALESCE(MAX(version_number), 0) AS v FROM journal_versions WHERE entry_date = ?",
                    (entry_date,),
                ).fetchone()
                next_v = int(row["v"] or 0) + 1
                conn.execute(
                    "INSERT INTO journal_versions(entry_date, version_number, body, word_count) VALUES(?,?,?,?)",
                    (entry_date, next_v, body, _word_count(body)),
                )
                conn.execute(
                    """
                    DELETE FROM journal_versions WHERE entry_date = ? AND version_number <= (
                        SELECT COALESCE(MAX(version_number), 0) - 10 FROM journal_versions WHERE entry_date = ?
                    )
                    """,
                    (entry_date, entry_date),
                )
        except Exception:
            logger.exception("Failed to save version for entry_date=%s (versions are non-critical)", entry_date)

    def list_versions(self, entry_date: str) -> list[JournalVersionSummary]:
        try:
            with get_db(self.db_path) as conn:
                rows = conn.execute(
                    "SELECT version_number, word_count, saved_at FROM journal_versions WHERE entry_date = ? ORDER BY version_number DESC",
                    (entry_date,),
                ).fetchall()
                return [JournalVersionSummary(version_number=int(row["version_number"]), word_count=row["word_count"], saved_at=str(row["saved_at"])) for row in rows]
        except Exception:
            return []

    def get_version(self, entry_date: str, version_number: int) -> JournalVersionDetail | None:
        try:
            with get_db(self.db_path) as conn:
                row = conn.execute(
                    "SELECT body, saved_at FROM journal_versions WHERE entry_date = ? AND version_number = ?",
                    (entry_date, version_number),
                ).fetchone()
                if not row:
                    return None
                return JournalVersionDetail(body=str(row["body"]), saved_at=str(row["saved_at"]))
        except Exception:
            return None

    # ── wikilinks ─────────────────────────────────────────────────────────────

    def persist_links(self, entry_id: str, target_slugs: list[str]) -> None:
        with tx(self.db_path) as conn:
            for slug in target_slugs:
                conn.execute(
                    "INSERT INTO journal_links (id, source_entry_id, target_slug) VALUES (?, ?, ?) ON CONFLICT(source_entry_id, target_slug) DO NOTHING",
                    (f"link_{entry_id}_{slug}", entry_id, slug),
                )

    def get_backlinks(self, identifier: str) -> list[str]:
        with get_db(self.db_path) as conn:
            rows = conn.execute(
                "SELECT source_entry_id FROM journal_links WHERE target_slug = ? ORDER BY source_entry_id ASC",
                (identifier,),
            ).fetchall()
            return [str(row["source_entry_id"]) for row in rows]

    def get_graph_data(self) -> dict[str, list[dict[str, object]]]:
        with get_db(self.db_path) as conn:
            node_rows = conn.execute("SELECT target_slug, COUNT(*) AS entry_count FROM journal_links GROUP BY target_slug ORDER BY target_slug ASC").fetchall()
            edge_rows = conn.execute("SELECT source_entry_id, target_slug FROM journal_links ORDER BY source_entry_id ASC").fetchall()
            return {
                "nodes": [{"id": row["target_slug"], "date": row["target_slug"], "entry_count": int(row["entry_count"])} for row in node_rows],
                "edges": [{"source": row["source_entry_id"], "target": row["target_slug"]} for row in edge_rows],
            }

    # ── analytics ─────────────────────────────────────────────────────────────

    def get_analytics_summary(self, days: int = 90) -> dict[str, object]:
        cutoff = (datetime.now(UTC).date() - timedelta(days=days - 1)).isoformat()
        with get_db(self.db_path) as conn:
            rows = conn.execute(
                "SELECT entry_date, markdown_body, emoji, tags_json, auto_tags_json FROM journal_entries WHERE deleted_at IS NULL AND entry_date >= ? ORDER BY entry_date ASC",
                (cutoff,),
            ).fetchall()

        mood_dist: Counter[str] = Counter()
        tags_ctr: Counter[str] = Counter()
        auto_tags_ctr: Counter[str] = Counter()
        words_per_day = []
        date_set: set[str] = set()

        for row in rows:
            d = str(row["entry_date"])
            date_set.add(d)
            emoji = (row["emoji"] or "").strip()
            if emoji:
                mood_dist[emoji] += 1
            for t in json.loads(row["tags_json"] or "[]"):
                tags_ctr[str(t)] += 1
            for t in json.loads(row["auto_tags_json"] or "[]"):
                auto_tags_ctr[str(t)] += 1
            words_per_day.append({"date": d, "word_count": _word_count(str(row["markdown_body"] or ""))})

        total = len(rows)
        avg_wc = round(sum(item["word_count"] for item in words_per_day) / total, 1) if total else 0.0

        streak_current = 0
        today = datetime.now(UTC).date()
        cur = today if today.isoformat() in date_set else today - timedelta(days=1)
        while cur.isoformat() in date_set:
            streak_current += 1
            cur -= timedelta(days=1)

        streak_longest = 0
        running = 0
        prev_date: date | None = None
        for ds in sorted(date_set):
            dt = datetime.strptime(ds, "%Y-%m-%d").date()
            if prev_date and dt == prev_date + timedelta(days=1):
                running += 1
            else:
                running = 1
            streak_longest = max(streak_longest, running)
            prev_date = dt

        return {
            "total_entries": total,
            "streak_current": streak_current,
            "streak_longest": streak_longest,
            "avg_word_count": avg_wc,
            "mood_distribution": dict(mood_dist),
            "words_per_day": words_per_day,
            "tags_top": [{"tag": t, "count": c} for t, c in tags_ctr.most_common(10)],
            "auto_tags_top": [{"tag": t, "count": c} for t, c in auto_tags_ctr.most_common(10)],
        }

    def get_heatmap(self, year: int) -> dict[str, int]:
        with get_db(self.db_path) as conn:
            rows = conn.execute(
                "SELECT entry_date FROM journal_entries WHERE deleted_at IS NULL AND entry_date LIKE ?",
                (f"{year:04d}-%",),
            ).fetchall()
        return {str(row["entry_date"]): 1 for row in rows}

    def get_auto_tag_stats(self) -> dict[str, int]:
        with get_db(self.db_path) as conn:
            rows = conn.execute("SELECT auto_tags_json FROM journal_entries WHERE deleted_at IS NULL").fetchall()
        counts: Counter[str] = Counter()
        for row in rows:
            for tag in json.loads(row["auto_tags_json"] or "[]"):
                counts[str(tag)] += 1
        return dict(counts.most_common())

    def search_rich(self, q: str = "", mood: str | None = None, limit: int = 50) -> list[JournalSearchResult]:
        with get_db(self.db_path) as conn:
            rows = conn.execute(
                "SELECT id, entry_date, markdown_body, emoji FROM journal_entries WHERE deleted_at IS NULL ORDER BY entry_date DESC"
            ).fetchall()

        results = []
        for row in rows:
            emoji = (row["emoji"] or "").strip()
            if mood and emoji != mood:
                continue
            body = str(row["markdown_body"] or "")
            if q and q.lower() not in _strip_markdown(body).lower():
                continue
            results.append(JournalSearchResult(id=str(row["id"]), date=str(row["entry_date"]), snippet=_snippet(body, q), emoji=emoji or None))
            if len(results) >= limit:
                break
        return results

    # ── templates ─────────────────────────────────────────────────────────────

    def list_templates(self) -> list[JournalTemplate]:
        with get_db(self.db_path) as conn:
            rows = conn.execute("SELECT * FROM journal_templates ORDER BY name ASC").fetchall()
            return [_row_to_template(row) for row in rows]

    def get_template(self, template_id: str) -> JournalTemplate | None:
        with get_db(self.db_path) as conn:
            row = conn.execute("SELECT * FROM journal_templates WHERE id = ?", (template_id,)).fetchone()
            return _row_to_template(row) if row else None

    def create_template(self, name: str, body: str, tags: list[str]) -> JournalTemplate:
        tpl_id = f"tpl_{uuid.uuid4().hex[:8]}"
        with tx(self.db_path) as conn:
            conn.execute(
                "INSERT INTO journal_templates (id, name, body, tags) VALUES (?, ?, ?, ?)",
                (tpl_id, name, body, json.dumps(tags)),
            )
            row = conn.execute("SELECT * FROM journal_templates WHERE id = ?", (tpl_id,)).fetchone()
            return _row_to_template(row)

    def update_template(self, template_id: str, patch: dict) -> JournalTemplate | None:
        existing = self.get_template(template_id)
        if not existing:
            return None
        name = patch.get("name", existing.name)
        body = patch.get("body", existing.body)
        tags = patch.get("tags", existing.tags)
        with tx(self.db_path) as conn:
            conn.execute(
                "UPDATE journal_templates SET name = ?, body = ?, tags = ? WHERE id = ?",
                (name, body, json.dumps(tags), template_id),
            )
        return self.get_template(template_id)

    def delete_template(self, template_id: str) -> bool:
        with tx(self.db_path) as conn:
            result = conn.execute("DELETE FROM journal_templates WHERE id = ?", (template_id,))
            return result.rowcount > 0

    # ── backup ────────────────────────────────────────────────────────────────

    def backup_status(self) -> JournalBackupStatus:
        backup_dir = Path.home() / ".local/share/ZoesTM/journal-backup"
        last_at: str | None = None
        if backup_dir.exists():
            files = sorted(backup_dir.glob("*.md"))
            if files:
                last_at = files[-1].stem
        return JournalBackupStatus(backup_path=str(backup_dir), last_backup_at=last_at)
