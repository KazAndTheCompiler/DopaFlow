from __future__ import annotations

from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile

from app.services.upload_security import validate_upload


def make_upload(filename: str, content: bytes, content_type: str = "application/octet-stream") -> UploadFile:
    return UploadFile(filename=filename, file=BytesIO(content), headers={"content-type": content_type})


def test_validate_upload_accepts_matching_magic_bytes() -> None:
    file = make_upload("deck.apkg", b"PK\x03\x04payload", "application/octet-stream")

    content, suffix = validate_upload(file, kind="apkg", allowed_suffixes={".apkg"}, default_max_bytes=64)

    assert content == b"PK\x03\x04payload"
    assert suffix == ".apkg"


def test_validate_upload_rejects_oversized_file_without_full_read() -> None:
    file = make_upload("big.json", b"{" + b"a" * 32, "application/json")

    with pytest.raises(HTTPException) as exc:
        validate_upload(file, kind="json", allowed_suffixes={".json"}, default_max_bytes=8)

    assert exc.value.status_code == 400
    assert "File too large" in str(exc.value.detail)
    assert file.file.tell() == 0


def test_validate_upload_rejects_magic_byte_mismatch() -> None:
    file = make_upload("deck.apkg", b"not-a-zip", "application/octet-stream")

    with pytest.raises(HTTPException) as exc:
        validate_upload(file, kind="apkg", allowed_suffixes={".apkg"}, default_max_bytes=64)

    assert exc.value.status_code == 400
    assert "does not match apkg format" in str(exc.value.detail)


def test_validate_upload_rejects_disallowed_content_type() -> None:
    file = make_upload("deck.apkg", b"PK\x03\x04payload", "text/plain")

    with pytest.raises(HTTPException) as exc:
        validate_upload(
            file,
            kind="apkg",
            allowed_suffixes={".apkg"},
            allowed_content_types={"application/octet-stream", "application/zip"},
            default_max_bytes=64,
        )

    assert exc.value.status_code == 400
    assert "Invalid content-type" in str(exc.value.detail)
