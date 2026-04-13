# Migration Policy

## Forward-only

DopaFlow uses forward-only migrations. Applied migrations are **never modified or deleted**. If a migration is incorrect, a new compensating migration is applied instead.

**Rationale:** SQLite does not support arbitrary rollback of schema changes. Production databases may have applied migrations that would break if earlier migrations were modified.

## Migration drift detection

Each migration file is checksummed (SHA-256) at application time. If the content of an already-applied migration file changes, a warning is logged:

```
Applied migration has been modified: 003_focus.sql
```

The migration will not be re-applied, but the warning indicates the file no longer matches what was originally run. This is a consistency signal, not a hard failure (to support the forward-only policy).

## Adding a new migration

1. Create a new `.sql` file in `backend/migrations/` with a name like `031_<description>.sql`
2. Use an incrementing numeric prefix
3. Test with a fresh database (`DOPAFLOW_DB_PATH=/tmp/test-migration.sqlite pytest tests/ -v`)
4. Do not modify or delete existing migration files

## Backup before risky schema upgrades

Before applying migrations that modify column types, drop tables, or restructure indexes:

```bash
# Backup the database
cp ~/.local/share/DopaFlow/db.sqlite ~/.local/share/DopaFlow/db.sqlite.backup-$(date +%Y%m%d-%H%M%S)

# Then run the migration
cd backend && DOPAFLOW_DB_PATH=~/.local/share/DopaFlow/db.sqlite python -c "from app.core.database import run_migrations; run_migrations('$HOME/.local/share/DopaFlow/db.sqlite')"
```

## Migration testing

`backend/tests/` includes `test_startup.py` which exercises the migration runner against a temporary database. Run:

```bash
cd backend && pytest tests/test_startup.py -v
```

## Startup behavior when database is unavailable

If `DOPAFLOW_DB_PATH` points to a non-existent file and the parent directory is not writable, the backend fails fast with a clear error:

```
RuntimeError: Database connection setup failed
```

The health endpoint (`/health/ready`) reports unhealthy when the database cannot be connected to, rather than silently degrading.
