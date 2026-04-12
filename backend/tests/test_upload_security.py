from __future__ import annotations

from io import BytesIO
from pathlib import Path

import httpx
import pytest
from fastapi import HTTPException, UploadFile

from app.services.upload_security import validate_upload

TRAVERSAL_FILENAMES = [
    "../../../etc/passwd",
    "..\\..\\..\\etc\\passwd",
    "/etc/passwd",
    "foo/../../../etc/passwd",
    "..%2f..%2f..%2fetc%2fpasswd",
    "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
]

UPLOAD_ENDPOINTS = [
    ("/api/v2/commands/voice-preview", "audio/webm"),
    ("/api/v2/journal/transcribe", "audio/webm"),
    ("/api/v2/packy/voice-command-audio", "audio/webm"),
    ("/api/v2/tasks/import/csv", "text/csv"),
    ("/api/v2/review/import-apkg", "application/octet-stream"),
]


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


@pytest.mark.parametrize("filename", ["../deck.apkg", "..\\deck.apkg", "/tmp/deck.apkg", "nested/deck.apkg"])
def test_validate_upload_rejects_path_traversal_and_nested_paths(filename: str) -> None:
    file = make_upload(filename, b"PK\x03\x04payload", "application/octet-stream")

    with pytest.raises(HTTPException) as exc:
        validate_upload(file, kind="apkg", allowed_suffixes={".apkg"}, default_max_bytes=64)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid filename"


@pytest.fixture()
def _app_with_ops_secret(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DOPAFLOW_OPS_SECRET", "test-ops-secret")
    monkeypatch.setenv("DOPAFLOW_DEV_AUTH", "true")
    monkeypatch.setenv("DOPAFLOW_DISABLE_LOCAL_AUDIO", "1")
    monkeypatch.setenv("DOPAFLOW_DISABLE_BACKGROUND_JOBS", "1")
    monkeypatch.setenv("DOPAFLOW_DISABLE_RATE_LIMITS", "1")
    monkeypatch.setenv("DOPAFLOW_DB_PATH", str(tmp_path / "test-upload-security.sqlite"))
    from app.core.config import get_settings

    get_settings.cache_clear()
    from app.core.database import run_migrations

    run_migrations(str(tmp_path / "test-upload-security.sqlite"))
    from app.main import create_app

    return create_app()


async def _request_upload(_app, path: str, *, filename: str, content_type: str, params: dict[str, str] | None = None, extra_headers: dict[str, str] | None = None) -> httpx.Response:
    transport = httpx.ASGITransport(app=_app, client=("127.0.0.1", 12345))
    headers = {"Authorization": "Bearer dev-local-key"}
    if extra_headers:
        headers.update(extra_headers)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        return await client.post(
            path,
            params=params,
            headers=headers,
            files={"file": (filename, b"payload", content_type)},
        )


@pytest.mark.anyio
@pytest.mark.parametrize("filename", TRAVERSAL_FILENAMES)
async def test_upload_endpoints_reject_path_traversal_filenames(_app_with_ops_secret, filename: str) -> None:
    _app = _app_with_ops_secret
    for path, content_type in UPLOAD_ENDPOINTS:
        if path == "/api/v2/review/import-apkg":
            deck_transport = httpx.ASGITransport(app=_app, client=("127.0.0.1", 12345))
            async with httpx.AsyncClient(transport=deck_transport, base_url="http://testserver") as client:
                deck = await client.post(
                    "/api/v2/review/decks",
                    json={"name": "Upload Guard"},
                    headers={"Authorization": "Bearer dev-local-key"},
                )
                assert deck.status_code == 200
                resp = await client.post(
                    path,
                    params={"deck_id": deck.json()["id"]},
                    headers={"Authorization": "Bearer dev-local-key"},
                    files={"file": (filename, b"payload", content_type)},
                )
        else:
            resp = await _request_upload(
                _app,
                path,
                filename=filename,
                content_type=content_type,
            )
        assert resp.status_code in {400, 422}, f"Expected 400/422 for {path} with filename={filename!r}, got {resp.status_code}: {resp.text}"
        assert resp.status_code != 500


@pytest.mark.anyio
async def test_ops_upload_endpoints_reject_path_traversal_filenames(_app_with_ops_secret) -> None:
    _app = _app_with_ops_secret
    ops_endpoints = [
        ("/api/v2/ops/backup/verify", "application/octet-stream"),
        ("/api/v2/ops/restore/db", "application/octet-stream"),
    ]
    for path, content_type in ops_endpoints:
        resp = await _request_upload(
            _app,
            path,
            filename="../../../etc/passwd",
            content_type=content_type,
            extra_headers={"X-Ops-Secret": "test-ops-secret"},
        )
        assert resp.status_code in {400, 422}, f"Expected 400/422 for {path}, got {resp.status_code}: {resp.text}"
        assert resp.status_code != 500
