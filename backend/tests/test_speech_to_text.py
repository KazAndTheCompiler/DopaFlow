from __future__ import annotations

from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile

from app.services.speech_to_text import transcribe_upload


def make_upload(filename: str, content: bytes, content_type: str) -> UploadFile:
    return UploadFile(
        filename=filename, file=BytesIO(content), headers={"content-type": content_type}
    )


def test_transcribe_upload_rejects_non_audio_content_type() -> None:
    file = make_upload("voice.webm", b"fake-audio", "text/plain")

    with pytest.raises(HTTPException) as exc:
        transcribe_upload(file)

    assert exc.value.status_code == 400
    assert "Invalid content-type" in str(exc.value.detail)


def test_transcribe_upload_rejects_path_traversal_filename() -> None:
    file = make_upload("../voice.webm", b"fake-audio", "audio/webm")

    with pytest.raises(HTTPException) as exc:
        transcribe_upload(file)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid filename"


def test_transcribe_upload_rejects_etc_passwd_traversal() -> None:
    file = make_upload("../../../etc/passwd", b"fake-audio", "audio/webm")

    with pytest.raises(HTTPException) as exc:
        transcribe_upload(file)

    assert exc.value.status_code == 400
    assert exc.value.detail == "Invalid filename"
