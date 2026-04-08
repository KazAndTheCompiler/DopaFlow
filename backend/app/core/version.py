"""Shared app version metadata loaded from the repository contract."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path


@lru_cache
def get_version_info() -> dict[str, str]:
    version_file = Path(__file__).resolve().parents[3] / "shared" / "version.json"
    with version_file.open(encoding="utf-8") as handle:
        payload = json.load(handle)

    return {
        "app_version": str(payload["appVersion"]),
        "schema_version": str(payload["schemaVersion"]),
        "token_contract": str(payload["tokenContract"]),
    }


APP_VERSION = get_version_info()["app_version"]
SCHEMA_VERSION = get_version_info()["schema_version"]
