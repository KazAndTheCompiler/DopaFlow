# Contributing to DopaFlow

## Setup

Requirements:

- Node 18+
- Python 3.11-3.12

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env
uvicorn app.main:app --reload
```

Desktop:

```bash
cd desktop
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`. Backend runs on `http://localhost:8000`.

## Before every PR

- [ ] Run `gitnexus_impact({target: "symbolName", direction: "upstream"})` before touching any function, class, or method.
- [ ] Do not proceed without review if GitNexus reports `HIGH` or `CRITICAL` risk.
- [ ] Use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` for every rename, then run the real rename.
- [ ] Run `gitnexus_detect_changes()` before committing and confirm the affected symbols and flows match the intended scope.
- [ ] Run `make validate` (or the relevant CI subset) before pushing.

## Code style

- Match the existing file structure and naming in the area you touch; keep changes narrow.
- Frontend: TypeScript, ES modules, double quotes, semicolons. Format with `npm run format` before committing.
- Backend: Format with `ruff format .` before committing. Lint with `ruff check .`.
- React code follows the current route/surface pattern and keeps components focused instead of adding broad refactors.
- Backend code follows the existing FastAPI layout under `backend/app`, keeps imports grouped, and stays consistent with current typing and spacing.
- Electron changes should stay within the current runtime/build scripts and package boundaries.
- Do not introduce new dependencies or formatting conventions unless the task requires them.

## Tests

Frontend typecheck and build:

```bash
cd frontend
npm run typecheck
npm run build
```

Frontend unit tests (Vitest):

```bash
cd frontend
npm run test:unit
```

Frontend browser smoke checks:

```bash
cd frontend
npm run test:e2e:smoke
```

Backend tests:

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v --tb=short
```

Desktop tests:

```bash
cd desktop
npm test
```

Full local validation (lint + typecheck + backend tests):

```bash
make validate
```
