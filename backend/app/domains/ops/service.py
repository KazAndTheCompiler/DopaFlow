"""Ops diagnostics, backup, export, and import helpers."""

from __future__ import annotations

import hashlib
import io
import json
import logging
import os
import sqlite3
import tempfile
import zipfile
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import Settings
from app.core.database import get_db, tx
from app.core.id_gen import habit_id, task_id
from app.core.version import APP_VERSION, SCHEMA_VERSION

logger = logging.getLogger(__name__)


class OpsService:
    REQUIRED_RESTORE_TABLES = frozenset(
        {"_migrations", "tasks", "habits", "journal_entries"}
    )

    def __init__(self, settings: Settings):
        self.settings = settings

    def _inspect_backup(self, content: bytes) -> dict[str, object]:
        if content[:16] != b"SQLite format 3\x00":
            return {
                "valid": False,
                "tables": [],
                "migration_version": None,
                "error": "Not a valid SQLite database",
            }

        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        try:
            tmp.write(content)
            tmp.flush()
            tmp.close()
            dbh = sqlite3.connect(tmp.name)
            try:
                integrity = dbh.execute("PRAGMA integrity_check").fetchone()
                integrity_result = integrity[0] if integrity else "unknown"
                if integrity_result != "ok":
                    return {
                        "valid": False,
                        "tables": [],
                        "migration_version": None,
                        "error": f"SQLite integrity check failed: {integrity_result}",
                    }
                tables = [
                    r[0]
                    for r in dbh.execute(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                    ).fetchall()
                ]
                missing_tables = sorted(self.REQUIRED_RESTORE_TABLES.difference(tables))
                try:
                    row = dbh.execute(
                        "SELECT filename FROM _migrations ORDER BY filename DESC LIMIT 1"
                    ).fetchone()
                    migration_version = row[0] if row else None
                except Exception:
                    migration_version = None
            finally:
                dbh.close()
        except Exception as exc:
            return {
                "valid": False,
                "tables": [],
                "migration_version": None,
                "error": str(exc),
            }
        finally:
            try:
                Path(tmp.name).unlink()
            except OSError:
                pass

        if missing_tables:
            return {
                "valid": False,
                "tables": tables,
                "migration_version": migration_version,
                "error": f"Backup missing required tables: {', '.join(missing_tables)}",
            }
        return {
            "valid": True,
            "tables": tables,
            "migration_version": migration_version,
            "error": None,
        }

    # ── metadata helpers ──────────────────────────────────────────────────────

    def _set_metadata(self, key: str, value: str) -> None:
        with tx(self.settings) as conn:
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
            with get_db(self.settings) as conn:
                row = conn.execute(
                    "SELECT value FROM ops_metadata WHERE key=?", (key,)
                ).fetchone()
            return row["value"] if row else None
        except Exception:
            return None

    def _optional_rows(
        self, conn: sqlite3.Connection, sql: str, *, table_name: str
    ) -> list[dict[str, object]]:
        try:
            return [dict(row) for row in conn.execute(sql).fetchall()]
        except sqlite3.OperationalError as exc:
            if "no such table" not in str(exc).lower():
                raise
            logger.warning(
                "Optional ops export table %s is unavailable: %s", table_name, exc
            )
            return []

    @staticmethod
    def _env_flag(name: str, legacy_name: str, default: str = "0") -> bool:
        raw = os.getenv(name)
        if raw is None:
            raw = os.getenv(legacy_name, default)
        return raw.lower() in {"1", "true", "yes"}

    # ── diagnostics ───────────────────────────────────────────────────────────

    def get_stats(self) -> dict[str, int]:
        with get_db(self.settings) as conn:
            tasks = int(conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0])
            habits = int(conn.execute("SELECT COUNT(*) FROM habits").fetchone()[0])
            journal_entries = int(
                conn.execute("SELECT COUNT(*) FROM journal_entries").fetchone()[0]
            )
        return {"tasks": tasks, "habits": habits, "journal_entries": journal_entries}

    def get_sync_status(self) -> dict[str, object]:
        db_file = Path(self.settings.db_path)
        try:
            db_size = db_file.stat().st_size
        except FileNotFoundError:
            db_size = 0
        entry_count = 0
        try:
            with get_db(self.settings) as conn:
                entry_count = int(
                    conn.execute("SELECT COUNT(*) FROM journal_entries").fetchone()[0]
                )
        except sqlite3.OperationalError as exc:
            if "no such table" not in str(exc).lower():
                raise
            logger.warning("Ops sync status could not count journal entries: %s", exc)
        return {
            "db_path": str(db_file),
            "db_size_bytes": db_size,
            "entry_count": entry_count,
            "last_backup_at": self._get_metadata("last_backup_at"),
        }

    def get_config(self) -> dict[str, object]:
        dev_auth = self._env_flag("DOPAFLOW_DEV_AUTH", "ZOESTM_DEV_AUTH")
        enforce_auth = self._env_flag("DOPAFLOW_ENFORCE_AUTH", "ZOESTM_ENFORCE_AUTH")
        trust_local = self._env_flag(
            "DOPAFLOW_TRUST_LOCAL_CLIENTS", "ZOESTM_TRUST_LOCAL_CLIENTS"
        )
        webhook_http_delivery = os.getenv(
            "ENABLE_WEBHOOK_HTTP_DELIVERY", "0"
        ).lower() in {"1", "true", "yes"}
        return {
            "dev_auth": dev_auth,
            "enforce_auth": enforce_auth,
            "trust_local_clients": trust_local,
            "db_path": self.settings.db_path,
            "webhook_http_delivery": webhook_http_delivery,
        }

    # ── export ────────────────────────────────────────────────────────────────

    def export_payload(self) -> dict[str, object]:
        with get_db(self.settings) as conn:
            tasks = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM tasks ORDER BY created_at"
                ).fetchall()
            ]
            habits = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM habit_checkins ORDER BY checkin_date"
                ).fetchall()
            ]
            journal = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM journal_entries WHERE deleted_at IS NULL ORDER BY entry_date"
                ).fetchall()
            ]
            decks = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM review_decks ORDER BY created_at"
                ).fetchall()
            ]
            cards = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM review_cards ORDER BY created_at"
                ).fetchall()
            ]
            nutrition = self._optional_rows(
                conn,
                "SELECT * FROM nutrition_log ORDER BY date",
                table_name="nutrition_log",
            )
            cmd_logs = self._optional_rows(
                conn,
                "SELECT * FROM command_logs ORDER BY executed_at DESC LIMIT 500",
                table_name="command_logs",
            )
        return {
            "manifest": {"schema_version": SCHEMA_VERSION, "app_version": APP_VERSION},
            "tasks": tasks,
            "commands": cmd_logs,
            "habits": habits,
            "journal": journal,
            "decks": decks,
            "cards": cards,
            "nutrition_log": nutrition,
        }

    def export_all_zip(self) -> bytes:
        with get_db(self.settings) as conn:
            tasks = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM tasks ORDER BY created_at"
                ).fetchall()
            ]
            habits = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM habit_checkins ORDER BY checkin_date"
                ).fetchall()
            ]
            journal = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM journal_entries WHERE deleted_at IS NULL ORDER BY entry_date"
                ).fetchall()
            ]
            alarms = [
                dict(r)
                for r in conn.execute(
                    "SELECT * FROM alarms ORDER BY created_at"
                ).fetchall()
            ]
            nutrition = self._optional_rows(
                conn,
                "SELECT * FROM nutrition_log ORDER BY date",
                table_name="nutrition_log",
            )
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as arc:
            arc.writestr(
                "tasks.json", json.dumps(tasks, indent=2, sort_keys=True, default=str)
            )
            arc.writestr(
                "habits.json", json.dumps(habits, indent=2, sort_keys=True, default=str)
            )
            arc.writestr(
                "journal.json",
                json.dumps(journal, indent=2, sort_keys=True, default=str),
            )
            arc.writestr(
                "alarms.json", json.dumps(alarms, indent=2, sort_keys=True, default=str)
            )
            arc.writestr(
                "nutrition.json",
                json.dumps(nutrition, indent=2, sort_keys=True, default=str),
            )
            arc.writestr("export_date.txt", datetime.now(UTC).isoformat())
        return buffer.getvalue()

    # ── backup / restore ──────────────────────────────────────────────────────

    def backup_db(self) -> tuple[str, str]:
        """Create a SQLite backup. Returns (tmp_path, filename)."""
        today = datetime.now(UTC).date().isoformat()
        tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        tmp.close()
        db_path = Path(self.settings.db_path)
        if db_path.exists():
            source = sqlite3.connect(str(db_path))
            try:
                source.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            except Exception:
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
        return self._inspect_backup(content)

    def restore_db(self, content: bytes) -> dict[str, object]:
        inspected = self._inspect_backup(content)
        if not inspected["valid"]:
            raise ValueError(str(inspected["error"]))

        db_path = Path(self.settings.db_path)
        tmp = tempfile.NamedTemporaryFile(
            dir=str(db_path.parent),
            prefix=f"{db_path.stem}-restore-",
            suffix=".db",
            delete=False,
        )
        try:
            tmp.write(content)
            tmp.flush()
            tmp.close()
        except Exception:
            raise
        bak_path = db_path.with_suffix(f"{db_path.suffix}.bak")
        try:
            if bak_path.exists():
                bak_path.unlink()
            if db_path.exists():
                os.replace(str(db_path), str(bak_path))
            os.replace(tmp.name, str(db_path))
        except Exception as exc:
            try:
                if bak_path.exists() and not db_path.exists():
                    os.replace(str(bak_path), str(db_path))
            except OSError:
                pass
            raise RuntimeError(f"Could not restore database: {exc}") from exc
        return {"ok": True, "message": "Database restored. Restart to apply."}

    # ── seed ──────────────────────────────────────────────────────────────────

    def seed_first_run(self) -> dict[str, object]:
        with get_db(self.settings) as conn:
            task_count = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
            habit_count = conn.execute("SELECT COUNT(*) FROM habits").fetchone()[0]
        if task_count or habit_count:
            return {"seeded": False, "message": "Sample data only seeds on first run"}
        today = datetime.now(UTC).date().isoformat()
        with tx(self.settings) as conn:
            conn.execute(
                "INSERT INTO tasks(id, title, due_at, priority) VALUES(?,?,?,?)",
                (task_id(), "Try the task list", f"{today}T12:00:00Z", 2),
            )
            conn.execute(
                "INSERT INTO tasks(id, title, due_at, priority) VALUES(?,?,?,?)",
                (task_id(), "Set up your first habit", f"{today}T18:00:00Z", 2),
            )
            conn.execute(
                "INSERT INTO habits(id, name) VALUES(?,?)",
                (habit_id(), "Morning check-in"),
            )
            conn.execute(
                "INSERT INTO habits(id, name) VALUES(?,?)",
                (habit_id(), "Evening wind-down"),
            )
        return {"seeded": True, "message": "Sample data added"}

    # ── import ────────────────────────────────────────────────────────────────

    def import_data(
        self, package: str, checksum: str, dry_run: bool = False
    ) -> dict[str, object]:
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

            with tx(self.settings) as conn:
                for t in tasks:
                    title = (t.get("title") or "").strip()
                    if not title:
                        continue
                    conn.execute(
                        "INSERT OR IGNORE INTO tasks(id, title, due_at, priority) VALUES(?,?,?,?)",
                        (
                            t.get("id") or str(uuid.uuid4()),
                            title,
                            t.get("due_at"),
                            int(t.get("priority") or 2),
                        ),
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
            "summary": {
                "tasks": len(tasks),
                "habits": len(habits),
                "dry_run": dry_run,
                "applied": not dry_run,
            },
            "conflicts": [],
        }
