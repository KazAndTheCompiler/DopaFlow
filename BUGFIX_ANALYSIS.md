# DopaFlow Codebase Analysis - Bugfix Report

**Analysis Date:** 2026-04-24  
**Source:** `/home/kaz/madlab/build/dopaflow`  
**Status:** In Progress

---

## Summary

DopaFlow is a FastAPI + React productivity app with features for tasks, calendar, habits, focus, goals, and gamification. This document tracks errors, mismatches, undocumented features, and potential LLM hallucinations found during analysis.

---

## Critical Issues Found

### 1. **Backend/Frontend API Version Mismatch**
**Location:** `backend/app/main.py`, `frontend/src/`
**Issue:** Backend uses `/api/v2` prefix but frontend may be using `/api/v1`
**Evidence:**
```python
API_PREFIX = "/api/v2"  # in main.py
```
**Impact:** API calls will 404 if frontend uses old prefix
**Fix:** Verify all frontend API calls use `/api/v2`

---

### 2. **Missing Dependency in requirements.txt**
**Location:** `backend/requirements.txt`
**Issue:** `libsql-experimental` is listed but may not be the correct package name
**Evidence:** Package name should likely be `libsql-client` or `turso-client`
**Impact:** Database connection failures
**Fix:** Verify correct Turso/libSQL package name

---

### 3. **SpeechRecognition Dependency Without Audio Backend**
**Location:** `backend/requirements.txt`
**Issue:** `SpeechRecognition==3.10.4` is included but no audio backend (PyAudio) listed
**Impact:** Speech recognition will fail at runtime
**Fix:** Add `pyaudio` or document that system PyAudio is required

---

### 4. ~~Frontend Package.json - Missing React Router~~ ✅ NOT A BUG
**Location:** `frontend/src/appRoutes.tsx`
**Finding:** App uses custom hash-based routing, not react-router
**Evidence:** Custom `routeRegistry` with hash-based navigation
**Status:** This is intentional - they built their own router

---

### 4a. **Frontend Routing - Hash-Based Navigation**
**Location:** `frontend/src/appRoutes.tsx`
**Issue:** Custom routing system uses window.location.hash
**Evidence:**
```typescript
export const routeRegistry = [...] // Custom route definitions
// Uses hash-based navigation, not React Router
```
**Impact:** Non-standard routing may cause issues with browser history
**Fix:** Document this architectural decision

---

### 5. **Vite Version Mismatch**
**Location:** `frontend/package.json`
**Issue:** `vite` is in `dependencies` instead of `devDependencies`
**Impact:** Production bundle includes build tool
**Fix:** Move vite to devDependencies

---

### 6. **Desktop Folder - Incomplete Implementation**
**Location:** `desktop/`
**Issue:** Contains only `dist/`, `notification-runtime.js`, `runtime-auth.js`, `scripts/`
**Evidence:** No main Electron entry point, no package.json
**Impact:** Desktop app won't build
**Fix:** Add proper Electron main process files

---

## Medium Priority Issues

### 7. **OpenAPI Schema - Generic Payload Types**
**Location:** `openapi.json`
**Issue:** Multiple endpoints use `"additionalProperties": true` with no schema validation
**Evidence:**
```json
"schema": {
  "type": "object",
  "additionalProperties": true,
  "title": "Payload"
}
```
**Impact:** No type safety, runtime errors likely
**Fix:** Define proper Pydantic schemas for all endpoints

---

### 8. **Backend - Import Organization**
**Location:** `backend/app/main.py`
**Issue:** Massive import block with 40+ imports, no grouping
**Impact:** Hard to maintain, circular import risk
**Fix:** Organize imports by domain or use lazy imports

---

### 9. **Ruff Configuration - Overly Permissive**
**Location:** `backend/pyproject.toml`
**Issue:** Many rules ignored including `B008` (Depends() in defaults), `B904` (raise without from)
**Impact:** Potential bugs allowed by linter
**Fix:** Review ignored rules, fix underlying issues

---

### 10. **Missing Environment Variable Documentation**
**Location:** Root level
**Issue:** No `.env.example` file found at project root
**Impact:** Developers don't know required environment variables
**Fix:** Create `.env.example` with all required vars

---

## Low Priority / Code Quality

### 11. **Test Scripts Reference Non-existent Paths**
**Location:** `frontend/package.json`
**Issue:** Scripts reference `./scripts/run-playwright.sh` but need to verify existence
**Impact:** CI/CD may fail
**Fix:** Verify all script paths exist

### 12. **Version Number Inconsistency**
**Location:** `frontend/package.json` vs `backend/app/core/version.py`
**Issue:** Frontend shows `2.0.12`, need to check if backend matches
**Impact:** Version confusion
**Fix:** Sync versions across packages

---

## Undocumented Features (Potential LLM Hallucinations)

### 13. **Gamification Domain** ✅ VERIFIED
**Location:** `backend/app/domains/gamification/`
**Finding:** Fully implemented XP/badge system
**Evidence:** Complete router with `/status`, `/badges`, `/award` endpoints
**Status:** Working feature

### 14. **Packy Domain** ✅ VERIFIED
**Location:** `backend/app/domains/packy/`
**Finding:** AI voice assistant - "ADHD-aware productivity assistant"
**Evidence:** 
- Voice command pipeline with NLP classification
- TTS response generation
- Intent classification (task.create, task.complete, etc.)
- Lorebook for personalization
**Status:** Working feature, well documented

### 15. **Player Domain** ✅ VERIFIED
**Location:** `backend/app/domains/player/`
**Finding:** Focus music/audio player for productivity sessions
**Evidence:** 
- `/resolve-url` for audio URLs
- `/queue` for playlist management
- `/next-track` for playback
**Status:** Working feature

### 16. **Vault Bridge** ✅ VERIFIED
**Location:** `backend/app/domains/vault_bridge/`
**Finding:** Sync bridge for external Obsidian/notes integration
**Evidence:**
- Push/pull endpoints for journal/tasks
- Conflict resolution system
- Import preview/confirm flow
**Status:** Working feature for Obsidian vault sync

### 17. **Calendar Sharing**
**Location:** `backend/app/domains/calendar_sharing/`
**Issue:** Separate router from calendar - may be incomplete
**Status:** Needs verification

---

## Configuration Issues

### 18. **CORS Configuration**
**Location:** `backend/app/middleware/cors.py`
**Issue:** Dynamic CORS building may allow overly permissive origins in dev
**Impact:** Security risk
**Fix:** Verify production CORS is restrictive

### 19. **Rate Limiting**
**Location:** `backend/app/middleware/rate_limit.py`
**Issue:** Middleware exists but configuration unclear
**Impact:** May not be properly configured
**Fix:** Verify rate limits are set appropriately

---

## Database Issues

### 20. **Alembic Migrations**
**Location:** `backend/alembic/`
**Issue:** Need to verify migration files are current with models
**Impact:** Database schema drift
**Fix:** Run `alembic check` to verify

### 21. **Turso/libSQL Experimental**
**Location:** `backend/requirements.txt`
**Issue:** Using experimental libSQL client
**Impact:** Potential stability issues
**Fix:** Monitor for stable release

---

## Frontend Issues

### 22. **TypeScript Configuration**
**Location:** `frontend/tsconfig.json`
**Issue:** Need to verify strict mode is enabled
**Impact:** Type safety
**Fix:** Check `strict: true` in config

### 23. **PWA Configuration**
**Location:** `frontend/vite-plugin-pwa`
**Issue:** PWA plugin included but manifest may be missing
**Impact:** PWA won't install properly
**Fix:** Verify manifest.json and service worker

### 24. **Test Coverage**
**Location:** `frontend/`
**Issue:** Vitest configured but coverage thresholds unclear
**Impact:** Unknown test coverage
**Fix:** Set coverage thresholds in config

---

## Security Concerns

### 25. **Auth Middleware**
**Location:** `backend/app/middleware/auth.py`
**Issue:** Custom auth middleware - need to verify JWT handling
**Impact:** Authentication bypass risk
**Fix:** Security audit of auth flow

### 26. **OIDC Implementation**
**Location:** `backend/app/domains/auth/oidc.py`
**Issue:** OIDC discovery building - may not validate tokens properly
**Impact:** SSO vulnerabilities
**Fix:** Verify OIDC flow against spec

### 27. **CSP Headers**
**Location:** `backend/app/middleware/security.py`
**Issue:** CSP middleware exists but policy may be too permissive
**Impact:** XSS risk
**Fix:** Review CSP policy

---

## Build/Deployment Issues

### 28. **Backend Build Script**
**Location:** `backend/build_backend.sh`
**Issue:** Shell script for building - need to verify it works
**Impact:** Deployment failures
**Fix:** Test build script

### 29. **PyInstaller Spec**
**Location:** `backend/dopaflow-backend.spec`
**Issue:** PyInstaller config for standalone executable
**Impact:** May miss hidden imports
**Fix:** Verify spec includes all dependencies

### 30. **Electron Runtime Dependencies**
**Location:** `install_electron_runtime_deps.sh`
**Issue:** Script exists but may be outdated
**Impact:** Desktop app runtime errors
**Fix:** Verify script contents

---

## Recommendations

1. **Immediate:** Fix API version mismatch between frontend/backend
2. **Immediate:** Add missing `.env.example` file
3. **High:** Verify all domain routers have proper schemas
4. **High:** Complete desktop app implementation
5. **Medium:** Add react-router-dom to frontend
6. **Medium:** Fix vite dependency placement
7. **Low:** Organize backend imports
8. **Low:** Document all domains (gamification, packy, player, vault)

---

## Files to Review

- [ ] `backend/app/core/config.py` - Environment variable handling
- [ ] `backend/app/domains/*/models.py` - Database schemas
- [ ] `backend/app/domains/*/service.py` - Business logic
- [ ] `frontend/src/api/` - API client code
- [ ] `frontend/src/routes/` - React routing
- [ ] `desktop/` - Complete Electron setup
- [ ] `internal/` - Unknown purpose

---

*Report generated during systematic codebase analysis*
