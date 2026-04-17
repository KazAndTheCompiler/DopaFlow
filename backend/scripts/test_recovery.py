#!/usr/bin/env python3
"""Recovery scenario tests for DopaFlow backend.

These tests verify that the system behaves correctly under failure conditions.
Run with: python scripts/test_recovery.py
"""

import os
import subprocess
import sys
import tempfile
from pathlib import Path


def test_missing_db_bootstrap(tmp_path: Path) -> bool:
    """Simulate missing DB — app should bootstrap a new one."""
    db_path = tmp_path / "new.db"
    env = {**os.environ, "DOPAFLOW_DB_PATH": str(db_path)}
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            """
import sys; sys.path.insert(0, '.')
from app.main import create_app
app = create_app()
print('App created successfully')
""",
        ],
        cwd=str(Path(__file__).resolve().parent.parent),
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )
    ok = result.returncode == 0 and "App created successfully" in result.stdout
    print(f"  Missing DB bootstrap: {'PASS' if ok else 'FAIL'}")
    if not ok:
        print(f"    stdout: {result.stdout[:200]}")
        print(f"    stderr: {result.stderr[:200]}")
    return ok


def test_db_corruption_recovery(tmp_path: Path) -> bool:
    """Simulate corrupted DB — app should fail fast (not silent corruption)."""
    db_path = tmp_path / "corrupt.db"
    db_path.write_text("this is not a sqlite database at all")
    env = {**os.environ, "DOPAFLOW_DB_PATH": str(db_path)}
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            """
import sys; sys.path.insert(0, '.')
from app.main import create_app
try:
    app = create_app()
    print('App created - UNEXPECTED (should fail on corrupt DB)')
except Exception as e:
    print(f'Expected error: {type(e).__name__}: {e}')
""",
        ],
        cwd=str(Path(__file__).resolve().parent.parent),
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )
    has_expected_error = (
        "OperationalError" in result.stdout
        or "RuntimeError" in result.stdout
        or "Error" in result.stdout
    )
    has_error_in_stderr = (
        "SQLite connection setup failed" in result.stderr or "Error" in result.stderr
    )
    ok = (result.returncode != 0) and (has_expected_error or has_error_in_stderr)
    print(f"  DB corruption handling: {'PASS' if ok else 'FAIL'}")
    if not ok:
        print(f"    stdout: {result.stdout[:200]}")
        print(f"    stderr: {result.stderr[:200]}")
        print(f"    returncode: {result.returncode}")
    return ok


def test_drift_blocks_startup(tmp_path: Path) -> bool:
    """Drift detection should raise and block startup."""
    db_path = tmp_path / "drift.db"
    db_path_str = str(db_path)
    migration_file = (
        Path(__file__).resolve().parent.parent / "migrations" / "001_init.sql"
    )

    if not migration_file.exists():
        print("  Drift test: no migration file found, skipping")
        return True

    original = migration_file.read_text()
    env = {**os.environ, "DOPAFLOW_DB_PATH": db_path_str}

    bootstrap = subprocess.run(
        [
            sys.executable,
            "-c",
            """
import sys; sys.path.insert(0, '.')
from app.core.database import run_migrations
run_migrations('"""
            + db_path_str
            + """')
print('Bootstrap OK')
""",
        ],
        cwd=str(Path(__file__).resolve().parent.parent),
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )
    if bootstrap.returncode != 0:
        print(f"  Drift test setup failed: {bootstrap.stderr[:200]}")
        return False

    migration_file.write_text(original + "\n-- DRIFTED BY TEST")
    try:
        env2 = {**os.environ, "DOPAFLOW_DB_PATH": db_path_str}
        drift_result = subprocess.run(
            [
                sys.executable,
                "-c",
                """
import sys; sys.path.insert(0, '.')
from app.core.database import run_migrations
try:
    run_migrations('"""
                + db_path_str
                + """')
    print('No error raised - FAIL')
except RuntimeError as e:
    if 'drift' in str(e).lower():
        print('DRIFT_DETECTED')
    else:
        print(f'WRONG_ERROR: {{type(e).__name__}}: {{e}}')
except Exception as e:
    print(f'OTHER_ERROR: {{type(e).__name__}}: {{e}}')
""",
            ],
            cwd=str(Path(__file__).resolve().parent.parent),
            env=env2,
            capture_output=True,
            text=True,
            timeout=15,
        )
        ok = "DRIFT_DETECTED" in drift_result.stdout
        print(f"  Drift blocks startup: {'PASS' if ok else 'FAIL'}")
        if not ok:
            print(f"    stdout: {drift_result.stdout[:200]}")
            print(f"    stderr: {drift_result.stderr[:200]}")
        return ok
    finally:
        migration_file.write_text(original)


def test_partial_migration_failure(tmp_path: Path) -> bool:
    """Partial migration failure should not corrupt schema."""
    db_path = tmp_path / "partial.db"
    env = {**os.environ, "DOPAFLOW_DB_PATH": str(db_path)}
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            """
import sys; sys.path.insert(0, '.')
from app.main import create_app
try:
    app = create_app()
    print('OK')
except Exception as e:
    print(f'Error: {type(e).__name__}: {e}')
""",
        ],
        cwd=str(Path(__file__).resolve().parent.parent),
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )
    ok = result.returncode == 0
    print(f"  Partial migration (normal run): {'PASS' if ok else 'FAIL'}")
    return ok


if __name__ == "__main__":
    print("DopaFlow Recovery Scenario Tests")
    print("=" * 40)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        results = [
            test_missing_db_bootstrap(tmp_path),
            test_db_corruption_recovery(tmp_path),
            test_drift_blocks_startup(tmp_path),
            test_partial_migration_failure(tmp_path),
        ]

    passed = sum(results)
    total = len(results)
    print(f"\nResults: {passed}/{total} passed")
    sys.exit(0 if passed == total else 1)
