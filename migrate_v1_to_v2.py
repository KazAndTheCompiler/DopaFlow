from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "v2" / "backend"))

from app.core.database import run_migrations  # noqa: E402


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table,),
    ).fetchone()
    return row is not None


def table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def scalar(conn: sqlite3.Connection, query: str, params: tuple[Any, ...]) -> Any:
    row = conn.execute(query, params).fetchone()
    if row is None:
        return None
    if isinstance(row, sqlite3.Row):
        return row[0]
    return row[0]


def pick(row: sqlite3.Row, *names: str) -> Any:
    for name in names:
        if name in row.keys():
            return row[name]
    return None


def migrate_tasks(src: sqlite3.Connection, dst: sqlite3.Connection) -> int:
    if not table_exists(src, "tasks"):
        return 0
    count = 0
    for row in src.execute("SELECT * FROM tasks"):
        if scalar(dst, "SELECT 1 FROM tasks WHERE id = ?", (row["id"],)):
            continue
        due_at = pick(row, "due_at", "due_date")
        description = pick(row, "notes", "description")
        dst.execute(
            """
            INSERT INTO tasks (
                id, title, description, due_at, priority, status, done,
                created_at, updated_at, subtasks_json, tags_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]')
            """,
            (
                row["id"],
                row["title"],
                description,
                due_at,
                int(pick(row, "priority") or 3),
                "done" if int(pick(row, "done") or 0) else "todo",
                int(pick(row, "done") or 0),
                pick(row, "created_at") or pick(row, "updated_at"),
                pick(row, "updated_at") or pick(row, "created_at"),
            ),
        )
        count += 1
    return count


def migrate_habits(src: sqlite3.Connection, dst: sqlite3.Connection) -> tuple[int, dict[str, str]]:
    if not table_exists(src, "habits"):
        return 0, {}
    count = 0
    name_to_id: dict[str, str] = {}
    columns = table_columns(src, "habits")
    for row in src.execute("SELECT * FROM habits"):
        name_to_id[str(row["name"])] = str(row["id"])
        if scalar(dst, "SELECT 1 FROM habits WHERE id = ?", (row["id"],)):
            continue
        target_freq = int(row["frequency"]) if "frequency" in columns and row["frequency"] is not None else int(pick(row, "target_freq") or 1)
        dst.execute(
            """
            INSERT INTO habits (
                id, name, target_freq, target_period, color, created_at, description, freeze_until
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                row["name"],
                target_freq,
                pick(row, "target_period") or "day",
                pick(row, "color"),
                pick(row, "created_at"),
                pick(row, "description"),
                pick(row, "freeze_until"),
            ),
        )
        count += 1
    return count, name_to_id


def migrate_habit_checkins(src: sqlite3.Connection, dst: sqlite3.Connection, name_to_id: dict[str, str]) -> int:
    if table_exists(src, "habit_checkins"):
        rows = src.execute("SELECT * FROM habit_checkins").fetchall()
        count = 0
        for row in rows:
            habit_id = str(pick(row, "habit_id"))
            checkin_date = str(pick(row, "checkin_date", "checked_at", "logged_at"))[:10]
            if scalar(dst, "SELECT 1 FROM habit_checkins WHERE habit_id = ? AND checkin_date = ?", (habit_id, checkin_date)):
                continue
            dst.execute(
                "INSERT INTO habit_checkins (id, habit_id, checkin_date) VALUES (?, ?, ?)",
                (f"migr_{habit_id}_{checkin_date}", habit_id, checkin_date),
            )
            count += 1
        return count

    if not table_exists(src, "habit_logs"):
        return 0

    count = 0
    for row in src.execute("SELECT * FROM habit_logs WHERE COALESCE(done, 1) = 1"):
        habit_name = str(pick(row, "habit_name", "name"))
        habit_id = name_to_id.get(habit_name)
        if not habit_id:
            continue
        checkin_date = str(pick(row, "checked_at", "logged_at", "created_at"))[:10]
        if scalar(dst, "SELECT 1 FROM habit_checkins WHERE habit_id = ? AND checkin_date = ?", (habit_id, checkin_date)):
            continue
        dst.execute(
            "INSERT INTO habit_checkins (id, habit_id, checkin_date) VALUES (?, ?, ?)",
            (f"migr_{habit_id}_{checkin_date}", habit_id, checkin_date),
        )
        count += 1
    return count


def migrate_focus_sessions(src: sqlite3.Connection, dst: sqlite3.Connection) -> int:
    source_table = "focus_log" if table_exists(src, "focus_log") else "focus_sessions" if table_exists(src, "focus_sessions") else None
    if source_table is None:
        return 0

    count = 0
    for row in src.execute(f"SELECT * FROM {source_table}"):
        source_id = str(row["id"])
        if scalar(dst, "SELECT 1 FROM focus_sessions WHERE id = ?", (source_id,)):
            continue
        started_at = pick(row, "started_at", "updated_at")
        ended_at = pick(row, "ended_at")
        duration_minutes = pick(row, "duration_m", "duration_minutes")
        if duration_minutes is None and pick(row, "duration_seconds") is not None:
            duration_minutes = max(1, int(pick(row, "duration_seconds")) // 60)
        if duration_minutes is None:
            duration_minutes = pick(row, "minutes") or 25
        status = "completed" if int(pick(row, "completed") or 0) else "stopped" if ended_at else "active"
        if source_table == "focus_sessions" and pick(row, "status"):
            status = str(pick(row, "status"))
        dst.execute(
            """
            INSERT INTO focus_sessions (id, task_id, started_at, ended_at, duration_minutes, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (source_id, pick(row, "task_id"), started_at, ended_at, int(duration_minutes), status),
        )
        count += 1
    return count


def migrate_journal_entries(src: sqlite3.Connection, dst: sqlite3.Connection) -> int:
    if not table_exists(src, "journal_entries"):
        return 0
    count = 0
    columns = table_columns(src, "journal_entries")
    for row in src.execute("SELECT * FROM journal_entries"):
        if scalar(dst, "SELECT 1 FROM journal_entries WHERE id = ? OR entry_date = ?", (row["id"], pick(row, "date", "created_at")[:10])):
            continue
        raw_tags = pick(row, "tags")
        if isinstance(raw_tags, str):
            if raw_tags.startswith("["):
                try:
                    tags = json.loads(raw_tags)
                except json.JSONDecodeError:
                    tags = [tag.strip() for tag in raw_tags.split(",") if tag.strip()]
            else:
                tags = [tag.strip() for tag in raw_tags.split(",") if tag.strip()]
        else:
            tags = []
        entry_date = pick(row, "date")
        if not entry_date:
            entry_date = str(pick(row, "created_at"))[:10]
        markdown_body = pick(row, "markdown_body") or ""
        if "title" in columns and row["title"]:
            markdown_body = f"# {row['title']}\n\n{markdown_body}".strip()
        dst.execute(
            """
            INSERT INTO journal_entries (
                id, markdown_body, emoji, entry_date, tags_json, version, locked, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)
            """,
            (
                row["id"],
                markdown_body,
                pick(row, "emoji"),
                entry_date,
                json.dumps(tags),
                pick(row, "created_at"),
                pick(row, "updated_at") or pick(row, "created_at"),
            ),
        )
        count += 1
    return count


def migrate_alarms(src: sqlite3.Connection, dst: sqlite3.Connection) -> int:
    if not table_exists(src, "alarms"):
        return 0
    meta_by_id: dict[str, sqlite3.Row] = {}
    if table_exists(src, "alarm_meta"):
        for row in src.execute("SELECT * FROM alarm_meta"):
            meta_by_id[str(row["alarm_id"])] = row
    count = 0
    for row in src.execute("SELECT * FROM alarms"):
        if scalar(dst, "SELECT 1 FROM alarms WHERE id = ?", (row["id"],)):
            continue
        meta = meta_by_id.get(str(row["id"]))
        title = meta["title"] if meta and meta["title"] else pick(row, "label") or "Migrated alarm"
        kind = meta["kind"] if meta and meta["kind"] else "alarm"
        tts_text = meta["tts_text"] if meta else None
        youtube_link = meta["youtube_link"] if meta else None
        muted = int(pick(row, "muted") or 0)
        if "enabled" in row.keys() and not int(row["enabled"]):
            muted = 1
        dst.execute(
            """
            INSERT INTO alarms (id, at, title, kind, tts_text, youtube_link, muted, last_fired_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                row["id"],
                pick(row, "alarm_time", "at"),
                title,
                kind,
                tts_text,
                youtube_link,
                muted,
                pick(row, "last_fired_at"),
            ),
        )
        count += 1
    return count


def migrate(src_path: Path, dst_path: Path) -> dict[str, int]:
    src = sqlite3.connect(f"file:{src_path}?mode=ro", uri=True)
    src.row_factory = sqlite3.Row
    run_migrations(str(dst_path))
    dst = sqlite3.connect(dst_path)
    dst.row_factory = sqlite3.Row
    dst.execute("PRAGMA foreign_keys=ON")

    try:
        summary: dict[str, int] = {}
        summary["tasks"] = migrate_tasks(src, dst)
        summary["habits"], name_to_id = migrate_habits(src, dst)
        summary["habit_checkins"] = migrate_habit_checkins(src, dst, name_to_id)
        summary["focus_sessions"] = migrate_focus_sessions(src, dst)
        summary["journal_entries"] = migrate_journal_entries(src, dst)
        summary["alarms"] = migrate_alarms(src, dst)
        dst.commit()
        return summary
    finally:
        src.close()
        dst.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True)
    parser.add_argument("--dst", required=True)
    args = parser.parse_args()

    try:
        summary = migrate(Path(args.src).expanduser(), Path(args.dst).expanduser())
        print(
            "Migrated "
            + ", ".join(f"{count} {name}" for name, count in summary.items())
        )
        return 0
    except Exception as exc:  # pragma: no cover - top-level CLI guard
        print(exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
