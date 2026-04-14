#!/usr/bin/env python3
"""GitHub Actions workflow job to check API contracts.

This runs as a separate CI job that compares the OpenAPI spec against
the baseline committed on main, and fails on breaking changes.
"""

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BASELINE_SPEC = REPO_ROOT / "openapi_baseline.json"


def main() -> None:
    from app.main import create_app

    current_spec = create_app().openapi()

    if BASELINE_SPEC.exists():
        with open(BASELINE_SPEC) as f:
            baseline = json.load(f)
    else:
        print("No baseline spec found, committing initial baseline")
        with open(BASELINE_SPEC, "w") as f:
            json.dump(current_spec, f, indent=2)
        subprocess.run(["git", "add", str(BASELINE_SPEC)], cwd=REPO_ROOT, check=False)
        print("Baseline spec committed. This should be merged to main.")
        return

    from scripts.api_contract_check import breaking_changes

    changes = breaking_changes(baseline, current_spec)
    if changes:
        print("BREAKING API CHANGES DETECTED:")
        for change in changes:
            print(f"  - {change}")
        print("\nIf these changes are intentional, update the baseline:")
        print("  git checkout main")
        print(
            "  python -c \"from app.main import create_app; import json; json.dump(create_app().openapi(), open('openapi_baseline.json', 'w'), indent=2)\""
        )
        print("  git commit -m 'chore: update OpenAPI baseline'")
        sys.exit(1)
    else:
        print("No breaking changes detected")


if __name__ == "__main__":
    main()
