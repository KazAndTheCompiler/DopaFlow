"""SQLite repository for the vault file index and vault configuration."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from app.domains.vault_bridge.schemas import VaultConfig, VaultFileRecord


@contextmanager
def _conn(db_path: str) -> Generator[sqlite3.Connection, None, None]:
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    try:
        yield con
        con.commit()
    finally:
        con.close()


class VaultIndexRepository:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    # ── config ────────────────────────────────────────────────────────────────

    def get_config(self) -> VaultConfig:
        with _conn(self.db_path) as con:
            rows = con.execute("SELECT key, value FROM vault_config").fetchall()
        kv = {r["key"]: r["value"] for r in rows}
        return VaultConfig(
            vault_enabled=kv.get("vault_enabled", "false").lower() == "true",
            vault_path=kv.get("vault_path", ""),
            daily_note_folder=kv.get("daily_note_folder", "Daily"),
            tasks_folder=kv.get("tasks_folder", "Tasks"),
            review_folder=kv.get("review_folder", "Review"),
            projects_folder=kv.get("projects_folder", "Projects"),
            attachments_folder=kv.get("attachments_folder", "Attachments"),
        )

    def update_config(self, updates: dict[str, str]) -> VaultConfig:
        with _conn(self.db_path) as con:
            for key, value in updates.items():
                con.execute(
                    "INSERT INTO vault_config (key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    (key, value),
                )
        return self.get_config()

    # ── file index ────────────────────────────────────────────────────────────

    def upsert_record(
        self,
        entity_type: str,
        entity_id: str,
        file_path: str,
        file_hash: str | None,
        direction: str,
        snapshot_body: str | None = None,
    ) -> VaultFileRecord:
        with _conn(self.db_path) as con:
            con.execute(
                """
                INSERT INTO vault_file_index
                    (entity_type, entity_id, file_path, file_hash, last_synced_at, last_direction, sync_status, snapshot_body)
                VALUES (?, ?, ?, ?, datetime('now'), ?, 'idle', ?)
                ON CONFLICT(file_path) DO UPDATE SET
                    file_hash=excluded.file_hash,
                    last_synced_at=excluded.last_synced_at,
                    last_direction=excluded.last_direction,
                    sync_status='idle',
                    snapshot_body=COALESCE(excluded.snapshot_body, vault_file_index.snapshot_body)
                """,
                (entity_type, entity_id, file_path, file_hash, direction, snapshot_body),
            )
        return self.get_by_file_path(file_path)  # type: ignore[return-value]

    def latest_sync_time(self, direction: str) -> str | None:
        with _conn(self.db_path) as con:
            row = con.execute(
                "SELECT MAX(last_synced_at) AS ts FROM vault_file_index WHERE last_direction=?",
                (direction,),
            ).fetchone()
        return row["ts"] if row and row["ts"] else None

    def mark_conflict(self, file_path: str) -> None:
        with _conn(self.db_path) as con:
            con.execute(
                "UPDATE vault_file_index SET sync_status='conflict' WHERE file_path=?",
                (file_path,),
            )

    def get_by_file_path(self, file_path: str) -> VaultFileRecord | None:
        with _conn(self.db_path) as con:
            row = con.execute(
                "SELECT * FROM vault_file_index WHERE file_path=?", (file_path,)
            ).fetchone()
        return VaultFileRecord(**dict(row)) if row else None

    def get_record(self, record_id: int) -> VaultFileRecord | None:
        with _conn(self.db_path) as con:
            row = con.execute(
                "SELECT * FROM vault_file_index WHERE id=?", (record_id,)
            ).fetchone()
        return VaultFileRecord(**dict(row)) if row else None

    def get_by_entity(self, entity_type: str, entity_id: str) -> VaultFileRecord | None:
        with _conn(self.db_path) as con:
            row = con.execute(
                "SELECT * FROM vault_file_index WHERE entity_type=? AND entity_id=?",
                (entity_type, entity_id),
            ).fetchone()
        return VaultFileRecord(**dict(row)) if row else None

    def list_records(self, entity_type: str | None = None) -> list[VaultFileRecord]:
        with _conn(self.db_path) as con:
            if entity_type:
                rows = con.execute(
                    "SELECT * FROM vault_file_index WHERE entity_type=? ORDER BY created_at",
                    (entity_type,),
                ).fetchall()
            else:
                rows = con.execute(
                    "SELECT * FROM vault_file_index ORDER BY created_at"
                ).fetchall()
        return [VaultFileRecord(**dict(r)) for r in rows]

    def list_conflicts(self) -> list[VaultFileRecord]:
        with _conn(self.db_path) as con:
            rows = con.execute(
                "SELECT * FROM vault_file_index WHERE sync_status='conflict'"
            ).fetchall()
        return [VaultFileRecord(**dict(r)) for r in rows]

    def get_snapshot(self, record_id: int) -> str | None:
        with _conn(self.db_path) as con:
            row = con.execute(
                "SELECT snapshot_body FROM vault_file_index WHERE id=?", (record_id,)
            ).fetchone()
        return row["snapshot_body"] if row else None

    def resolve_conflict(self, file_path: str) -> None:
        with _conn(self.db_path) as con:
            con.execute(
                "UPDATE vault_file_index SET sync_status='idle' WHERE file_path=?",
                (file_path,),
            )
