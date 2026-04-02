"""Validate uploaded files by suffix, content type, size, and magic bytes."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import HTTPException, UploadFile

if TYPE_CHECKING:
    from fastapi import UploadFile

MAGIC_BYTES = {
    "sqlite": b"SQLite format 3\x00",
    "zip": b"PK\x03\x04",
    "apkg": b"PK\x03\x04",  # .apkg files are ZIP archives
    "json": b"{",
    "json_array": b"[",
}


def validate_upload(
    file: UploadFile,
    kind: str = "generic",
    allowed_suffixes: set[str] | None = None,
    allowed_content_types: set[str] | None = None,
    default_max_bytes: int = 10 * 1024 * 1024,
) -> tuple[bytes, str]:
    """Validate an uploaded file by size, suffix, MIME type, and signature."""

    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    content = file.file.read()
    if len(content) > default_max_bytes:
        raise HTTPException(status_code=400, detail=f"File too large (max {default_max_bytes} bytes)")

    suffix = Path(file.filename).suffix.lower()
    if allowed_suffixes and suffix not in allowed_suffixes:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {suffix}")

    if allowed_content_types and file.content_type not in allowed_content_types:
        raise HTTPException(status_code=400, detail=f"Invalid content-type: {file.content_type}")

    if kind in MAGIC_BYTES and not content.startswith(MAGIC_BYTES[kind]):
        raise HTTPException(status_code=400, detail=f"File does not match {kind} format")

    return content, suffix
