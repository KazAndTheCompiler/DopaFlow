from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.domains.ops.schemas import ScopeTokenCreateIn, TursoTestIn


def test_turso_test_input_rejects_non_turso_scheme() -> None:
    with pytest.raises(ValidationError):
        TursoTestIn(url="http://example.com", token="secret")


def test_scope_token_create_input_enforces_bounds() -> None:
    with pytest.raises(ValidationError):
        ScopeTokenCreateIn(scopes=[], subject="", ttl_seconds=30)
