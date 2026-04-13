#!usr/bin/env python3
"""Fail fast on forbidden secret-like repo contents and machine-specific paths."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
ALLOWED_DEPLOY_KEYS = {REPO_ROOT / ".deploy-keys" / "README.md"}
IGNORED_SCAN_ROOTS = {
    REPO_ROOT / ".git",
    REPO_ROOT / ".venv",
    REPO_ROOT / "docs" / "internal" / "ai-workflow" / "LLM_work_folder",
    REPO_ROOT / "build",
    REPO_ROOT / "release",
    REPO_ROOT / "desktop" / "dist",
    REPO_ROOT / "node_modules",
    REPO_ROOT / "tools" / "mcp" / "node-tooling-bridge" / "vendor",
}
IGNORED_PATTERN_FILES = {
    REPO_ROOT / "scripts" / "check_repo_hygiene.py",
}
MACHINE_PATH_IGNORED_FILES = {
    REPO_ROOT / "CHANGELOG.md",
    REPO_ROOT / "summary_minimax_the_goat.md",
}
IGNORED_PATH_PREFIXES = (
    REPO_ROOT / "desktop" / "vendor-runtime",
    REPO_ROOT / "docs",
    REPO_ROOT / "frontend" / "tests",
)
PRIVATE_KEY_PATTERNS = (
    re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----"),
    re.compile(r"-----BEGIN OPENSSH PRIVATE KEY-----"),
)
MACHINE_PATH_PATTERNS = (
    re.compile(r"/home/\w+"),
    re.compile(r"/Users/\w+"),
    re.compile(r"C:\\Users\\"),
    re.compile(r"/mnt/"),
    re.compile(r"/Volumes/"),
    re.compile(r"/root/"),
)


def _is_ignored(path: Path) -> bool:
    return any(root == path or root in path.parents for root in IGNORED_SCAN_ROOTS)


def repo_files() -> list[Path]:
    proc = subprocess.run(
        [
            "git",
            "-C",
            str(REPO_ROOT),
            "ls-files",
            "--cached",
            "--others",
            "--exclude-standard",
            "--deduplicate",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    result: list[Path] = []
    for line in proc.stdout.splitlines():
        if not line:
            continue
        path = REPO_ROOT / line
        if path.exists() and path.is_file() and not _is_ignored(path):
            result.append(path)
    return result


def main() -> int:
    failures: list[str] = []
    for path in repo_files():
        try:
            rel = path.relative_to(REPO_ROOT)
        except ValueError:
            continue

        if (
            rel.parts
            and rel.parts[0] == ".deploy-keys"
            and path not in ALLOWED_DEPLOY_KEYS
        ):
            failures.append(f"forbidden tracked file under .deploy-keys: {rel}")
            continue

        if not path.is_file():
            continue

        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError as exc:
            failures.append(f"could not read {rel}: {exc}")
            continue

        if path in IGNORED_PATTERN_FILES:
            continue

        for pattern in PRIVATE_KEY_PATTERNS:
            if pattern.search(text):
                failures.append(f"private key material detected in {rel}")
                break

        if path in MACHINE_PATH_IGNORED_FILES:
            continue
        if any(str(path).startswith(str(prefix)) for prefix in IGNORED_PATH_PREFIXES):
            continue
        for pattern in MACHINE_PATH_PATTERNS:
            if pattern.search(text):
                failures.append(f"machine-specific absolute path detected in {rel}")
                break

    if failures:
        print("Repo hygiene check failed:", file=sys.stderr)
        for failure in failures:
            print(f" - {failure}", file=sys.stderr)
        return 1

    print("Repo hygiene check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
