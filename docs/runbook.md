# Runbook

## Backend won't start

**Symptoms:** `uvicorn` exits immediately, or the desktop app shows "backend unavailable".

**Diagnostic steps:**

1. Check Python version: `python3 --version` (must be 3.11 or 3.12)
2. Check dependencies: `cd backend && pip install -r requirements.txt`
3. Check database path is writable:
   ```bash
   ls -la ~/.local/share/DopaFlow/  # Linux/macOS
   # or check %APPDATA%\DopaFlow\    # Windows
   ```
4. Try with a fresh database: `DOPAFLOW_DB_PATH=/tmp/test.db uvicorn app.main:app --reload`
5. Check port 8000 is free: `lsof -i :8000` or `netstat -an | grep 8000`

**Common fixes:**
- Missing `python-multipart`: `pip install python-multipart`
- WAL journal lock: delete `*.db-wal` and `*.db-shm` files next to the db
- Corrupted database: restore from `journal-backup/` if available

## Packaged desktop can't reach backend

**Symptoms:** App loads but shows empty surfaces, or "Backend unavailable" toast.

**Diagnostic steps:**

1. Desktop backend listens on `localhost:8000` — verify with:
   ```bash
   curl http://localhost:8000/health/ready
   ```
2. Check the desktop log (stdout/stderr where the app was launched)
3. On Linux: check if `localhost` resolves correctly
4. Check firewall: `iptables -L -n | grep 8000` or `ufw status`

**Common fixes:**
- Another process on port 8000: find and stop it
- SELinux/AppArmor blocking Electron's subprocess: run with `--no-sandbox` or configure the security module

## Database migration failures

**Symptoms:** Backend fails to start, error contains `no such table` or `duplicate column`.

**Diagnostic steps:**

1. Check migration status:
   ```bash
   python3 -c "
   import sqlite3
   conn = sqlite3.connect('$HOME/.local/share/DopaFlow/db.sqlite')
   for row in conn.execute('SELECT filename, applied_at, checksum FROM _migrations ORDER BY applied_at').fetchall():
       print(row)
   conn.close()
   "
   ```
2. Compare applied migrations against `backend/migrations/*.sql`

**Common fixes:**
- Migration partially applied: restore from backup (see `docs/migrations.md`)
- Checksum drift warning: this is informational if no actual problem occurred

## Playwright E2E tests fail in CI

**Symptoms:** `release.yml` fails at the E2E step but local tests pass.

**Diagnostic steps:**

1. Check if the test expects a live backend — `smoke` and `core` suites use mocked responses
2. The `release` suite requires the packaged backend artifact to be present
3. Verify `npm ci` ran successfully (cache may be stale on first run)

## Auth rejection on packaged app

**Symptoms:** All API calls return 401 even on local desktop.

**Diagnostic steps:**

1. Verify `DOPAFLOW_TRUST_LOCAL_CLIENTS=1` is set in the desktop runtime
2. Check `desktop/runtime-auth.js` line 7

## Hot reload not working in dev

**Symptoms:** Changes to frontend files don't reflect in browser.

**Diagnostic steps:**

1. Use `npm run dev` (not just `vite`, which bypasses the React router HMR setup)
2. Check browser console for HMR connection errors
3. Try clearing browser cache or using incognito mode
