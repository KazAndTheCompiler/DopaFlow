"""Shared app version metadata loaded from the repository contract."""

from __future__ import annotations

import json
import sys
from functools import lru_cache
from pathlib import Path


def _find_version_file() -> Path:
    """Locate shared/version.json in both dev and PyInstaller environments."""
    # PyInstaller bundles data files under sys._MEIPASS / <name>
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass is not None:
        candidate = Path(meipass) / "shared" / "version.json"
        if candidate.exists():
            return candidate

    # Source tree: app/core/version.py → parents[3] == repo root
    return Path(__file__).resolve().parents[3] / "shared" / "version.json"


@lru_cache
def get_version_info() -> dict[str, str]:
    version_file = _find_version_file()
    with version_file.open(encoding="utf-8") as handle:
        payload = json.load(handle)

    return {
        "app_version": str(payload["appVersion"]),
        "schema_version": str(payload["schemaVersion"]),
        "token_contract": str(payload["tokenContract"]),
    }


APP_VERSION = get_version_info()["app_version"]
SCHEMA_VERSION = get_version_info()["schema_version"]
