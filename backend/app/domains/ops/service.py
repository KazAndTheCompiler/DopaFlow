"""Ops diagnostics, backup, export, and import helpers."""

from __future__ import annotations

import hashlib
import io
import json
import os
import shutil
import sqlite3
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path

from app.core.database import get_db, tx


class OpsService:
    def __init__(self, db_path: str):
        self.db_path = db_path

    # ── metadata helpers ──────────────────────────────────────────────────────

    def _set_metadata(self, key: str, value: str) -> None:
        with tx(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO ops_metadata(key, value, updated_at)
                VALUES(?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
                """,
                (key, value),
            )

    def _get_metadata(self, key: str) -> str | None:
        try:
            with get_db(self.db_path) as conn:
                row = conn.execute("SELECT value FROM ops_metadata WHERE key=?", (key,)).fetchone()
            return row["value"] if row else None
        except Exception:  # noqa: BLE001
            return None

    # ── diagnostics ───────────────────────────────────────────────────────────

    def get_stats(self) -> dict[str, int]:
        with get_db(self.db_path) as conn:
            tasks = int(conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0])
            habits = int(conn.execute("SELECT COUNT(*) FROM habits").fetchone()[0])
            journal_entries = int(conn.execute("SELECT COUNT(*) FROM journal_entries").fetchone()[0])
        return {"tasks": tasks, "habits": habits, "journal_entries": journal_entries}

    def get_sync_status(self) -> dict[str, object]:
        db_file = Path(self.db_path)
        try:
            db_size = db_file.stat().st_size
        except FileNotFoundError:
            db_size = 0
        entry_count = 0
        try:
            with get_db(self.db_path) as conn:
                entry_count = int(conn.execute("SELECT COUNT(*) FROM journal_entries").fetchone()[0])
        except Exception:  # noqa: BLE001
            pass
        return {
            "db_path": str(db_file),
            "db_size_bytes": db_size,
            "entry_count": entry_count,
            "last_backup_at": self._get_metadata("last_backup_at"),
        }

    def get_config(self) -> dict[str, object]:
        dev_auth = os.getenv("DOPAFLOW_DEV_AUTH", os.getenv("ZOESTM_DEV_AUTH", "0")).lower() in {"1", "true", "yes"}
        enforce_auth = os.getenv("DOPAFLOW_ENFORCE_AUTH", os.getenv("ZOESTM_ENFORCE_AUTH", "0")).lower() in {"1", "true", "yes"}
        trust_local = os.getenv("ZOESTM_TRUST_LOCAL_CLIENTS", "1").lower() in {"1", "true", "yes"}
        webhook_http_delivery = os.getenv("ENABLE_WEBHOOK_HTTP_DELIVERY", "0").lower() in {"1", "true", "yes"}
        return {
            "dev_auth": dev_auth,
            "enforce_auth": enforce_auth,
            "trust_local_clients": trust_local,
            "db_path": self.db_path,
            "webhook_http_delivery": webhook_http_delivery,
        }

    # ── export ────────────────────────────────────────────────────────────────

    def export_payload(self) -> dict[str, object]:
        with get_db(self.db_path) as conn:
            tasks = [dict(r) for r in conn.execute("SELECT * FROM tasks ORDER BY created_at").fetchall()]
            habits = [dict(r) for r in conn.execute("SELECT * FROM habit_checkins ORDER BY checkin_date").fetchall()]
            journal = [dict(r) for r in conn.execute("SELECT * FROM journal_entries WHERE deleted_at IS NULL ORDER BY entry_date").fetchall()]
            decks = [dict(r) for r in conn.execute("SELECT * FROM review_decks ORDER BY created_at").fetchall()]
            cards = [dict(r) for r in conn.execute("SELECT * FROM review_cards ORDER BY created_at").fetchall()]
            try:
                nutrition = [dict(r) for r in conn.execute("SELECT * FROM nutrition_log ORDER BY date").fetchall()]
            except Exception:  # noqa: BLE001
                nutrition = []
            try:
                cmd_logs = [dict(r) for r in conn.execute("SELECT * FROM command_logs ORDER BY executed_at DESC LIMIT 500").fetchall()]
            except Exception:  # noqa: BLE001
                cmd_logs = []
        return {
            "manifest": {"schema_version": "v2", "app_version": "2.0.0"},
            "tasks": tasks,
            "commands": cmd_logs,
            "habits": habits,
            "journal": journal,
            "decks": decks,
            "cards": cards,
            "nutrition_log": nutrition,
        }

    def export_all_zip(self) -> bytes:
        with get_db(self.db_path) as conn:
            tasks = [dict(r) for r in conn.execute("SELECT * FROM tasks ORDER BY created_at").fetchall()]
            habits = [dict(r) for r in conn.execute("SELECT * FROM habit_checkins ORDER BY checkin_date").fetchall()]
            journal = [dict(r) for r in conn.execute("SELECT * FROM journal_entries WHERE deleted_at IS NULL ORDER BY entry_date").fetchall()]
            alarms = [dict(r) for r in conn.execute("SELECT * FROM alarms ORDER BY created_at").fetchall()]
            try:
                nutrition = [dict(r) for r in conn.execute("SELECT * FROM nutrition_log ORDER BY date").fetchall()]
            except Exception:  # noqa: BLE001
                nutrition = []
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as arc:
            arc.writestr("tasks.json", json.dumps(tasks, indent=2, sort_keys=True, default=str))
            arc.writestr("habits.json", json.dumps(habits, indent=2, sort_keys=True, default=str))
            arc.writestr("journal.json", json.dumps(journal, indent=2, sort_keys=True, default=str))
            arc.writestr("alarms.json", json.dumps(alarms, indent=2, sort_keys=True, default=str))
            arc.writestr("nutrition.json", json.dumps(nutrition, indent=2, sort_keys=True, default=str))
            arc.writestr("export_date.txt", datetime.now(UTC).isoformat())
        return buffer.getvalue()

    # ── backup / restore ──────────────────────────────────────────────────────

    def backup_db(self) -> tuple[str, str]:
        """Create a SQLite backup. Returns (tmp_path, filename)."""
        today = datetime.now(UTC).date().isoformat()
        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tmp.close()
        db_path = Path(self.db_path)
        if db_path.exists():
            source = sqlite3.connect(str(db_path))
            try:
                source.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            except Exception:  # noqa: BLE001
                pass
            target = sqlite3.connect(tmp.name)
            try:
                source.backup(target)
            finally:
                target.close()
                source.close()
        else:
            raise RuntimeError("Database file not found")
        self._set_metadata("last_backup_at", datetime.now(UTC).isoformat())
        return tmp.name, f"dopaflow-backup-{today}.db"

    def verify_backup(self, content: bytes) -> dict[str, object]:
        if content[:16] != b"SQLite format 3\x00":
            return {"valid": False, "tables": [], "migration_version": None, "error": "Not a valid SQLite database"}
        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        try:
            tmp.write(content)
            tmp.flush()
            tmp.close()
            dbh = sqlite3.connect(tmp.name)
            try:
                tables = [r[0] for r in dbh.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()]
                try:
                    row = dbh.execute("SELECT filename FROM _migrations ORDER BY filename DESC LIMIT 1").fetchone()
                    migration_version = row[0] if row else None
                except Exception:  # noqa: BLE001
                    migration_version = None
            finally:
                dbh.close()
            return {"valid": True, "tables": tables, "migration_version": migration_version, "error": None}
        except Exception as exc:  # noqa: BLE001
            return {"valid": False, "tables": [], "migration_version": None, "error": str(exc)}

    def restore_db(self, content: bytes) -> dict[str, object]:
        if content[:16] != b"SQLite format 3\x00":
            raise ValueError("Not a valid SQLite database")
        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        try:
            tmp.write(content)
            tmp.flush()
            tmp.close()
        except Exception:
            raise
        db_path = Path(self.db_path)
        bak_path = db_path.with_suffix(f"{db_path.suffix}.bak")
        try:
            if bak_path.exists():
                bak_path.unlink()
            if db_path.exists():
                shutil.move(str(db_path), str(bak_path))
            shutil.move(tmp.name, str(db_path))
        except Exception as exc:
            raise RuntimeError(f"Could not restore database: {exc}") from exc
        return {"ok": True, "message": "Database restored. Restart to apply."}

    # ── seed ──────────────────────────────────────────────────────────────────

    def seed_first_run(self) -> dict[str, object]:
        with get_db(self.db_path) as conn:
            task_count = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
            habit_count = conn.execute("SELECT COUNT(*) FROM habits").fetchone()[0]
        if task_count or habit_count:
            return {"seeded": False, "message": "Sample data only seeds on first run"}
        today = datetime.now(UTC).date().isoformat()
        import uuid
        with tx(self.db_path) as conn:
            conn.execute(
                "INSERT INTO tasks(id, title, due_at, priority) VALUES(?,?,?,?)",
                (str(uuid.uuid4()), "Try the task list", f"{today}T12:00:00Z", 2),
            )
            conn.execute(
                "INSERT INTO tasks(id, title, due_at, priority) VALUES(?,?,?,?)",
                (str(uuid.uuid4()), "Set up your first habit", f"{today}T18:00:00Z", 2),
            )
            conn.execute("INSERT INTO habits(id, name) VALUES(?,?)", (str(uuid.uuid4()), "Morning check-in"))
            conn.execute("INSERT INTO habits(id, name) VALUES(?,?)", (str(uuid.uuid4()), "Evening wind-down"))
        return {"seeded": True, "message": "Sample data added"}

    # ── import ────────────────────────────────────────────────────────────────

    def import_data(self, package: str, checksum: str, dry_run: bool = False) -> dict[str, object]:
        calc = hashlib.sha256(package.encode("utf-8")).hexdigest()
        if calc != checksum:
            raise ValueError("Checksum mismatch")
        parsed = json.loads(package)
        if parsed.get("manifest", {}).get("schema_version") != "v2":
            raise ValueError("Schema version mismatch — expected v2")
        tasks = parsed.get("tasks", [])
        habits = parsed.get("habits", [])
        if not dry_run:
            import uuid
            with tx(self.db_path) as conn:
                for t in tasks:
                    title = (t.get("title") or "").strip()
                    if not title:
                        continue
                    conn.execute(
                        "INSERT OR IGNORE INTO tasks(id, title, due_at, priority) VALUES(?,?,?,?)",
                        (t.get("id") or str(uuid.uuid4()), title, t.get("due_at"), int(t.get("priority") or 2)),
                    )
                for h in habits:
                    habit_id = (h.get("habit_id") or "").strip()
                    checkin_date = (h.get("checkin_date") or "").strip()
                    if habit_id and checkin_date:
                        conn.execute(
                            "INSERT OR IGNORE INTO habit_checkins(id, habit_id, checkin_date) VALUES(?,?,?)",
                            (h.get("id") or str(uuid.uuid4()), habit_id, checkin_date),
                        )
        return {
            "status": "ok",
            "summary": {"tasks": len(tasks), "habits": len(habits), "dry_run": dry_run, "applied": not dry_run},
            "conflicts": [],
        }
