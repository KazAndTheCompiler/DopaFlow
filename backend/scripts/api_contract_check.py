#!/usr/bin/env python3
"""Detect breaking API changes by comparing OpenAPI specs."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def load_spec(path: str | Path) -> dict:
    with open(path) as f:
        return json.load(f)


def get_routes(spec: dict) -> dict[str, dict]:
    routes: dict[str, dict] = {}
    for path, methods in spec.get("paths", {}).items():
        if isinstance(methods, dict):
            routes[path] = methods
    return routes


def breaking_changes(baseline: dict, current: dict) -> list[str]:
    """Return list of breaking changes from baseline to current.

    Only REMOVED endpoints/methods are breaking. ADDED endpoints are
    backward-compatible and reported as info, not errors.
    """
    changes: list[str] = []
    base_routes = get_routes(baseline)
    curr_routes = get_routes(current)

    for path, methods in base_routes.items():
        if path not in curr_routes:
            changes.append(f"REMOVED endpoint: {path} (all methods)")
            continue
        for method in methods:
            if method.lower() in {"get", "post", "put", "patch", "delete"}:
                if method.lower() not in curr_routes[path]:
                    changes.append(f"REMOVED method: {method.upper()} {path}")

    # Report additions as info (non-breaking)
    additions: list[str] = []
    for path, methods in curr_routes.items():
        if path not in base_routes:
            additions.append(f"ADDED endpoint: {path}")
            continue
        for method in methods:
            if method.lower() in {"get", "post", "put", "patch", "delete"}:
                if method.lower() not in base_routes.get(path, {}):
                    additions.append(f"ADDED method: {method.upper()} {path}")

    if additions:
        print("Non-breaking additions (OK):")
        for a in additions:
            print(f"  - {a}")

    return changes


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: api_contract_check.py <baseline_spec.json> <current_spec.json>")
        sys.exit(0)

    baseline_path = Path(sys.argv[1])
    current_path = Path(sys.argv[2])

    if not baseline_path.exists():
        print(f"No baseline spec found at {baseline_path}, skipping contract check")
        sys.exit(0)

    baseline = load_spec(baseline_path)
    current = load_spec(current_path)

    changes = breaking_changes(baseline, current)
    if changes:
        print("BREAKING API CHANGES DETECTED:")
        for change in changes:
            print(f"  - {change}")
        sys.exit(1)
    else:
        print("No breaking changes detected")
        sys.exit(0)
