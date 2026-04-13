# ADR-002: Security Model and Trust Boundaries

## Status

Accepted — v2.0.11

## Context

DopaFlow is a local-first, single-user desktop productivity application. It must function without network connectivity, without user accounts, and without any third-party cloud services. These constraints shape the entire security model differently from a server-side SaaS application.

The application ships as:
1. A web app served from `localhost` by a bundled backend
2. An Electron desktop app that bundles the backend + frontend into a single executable
3. A web app against a remote backend (optional, for users who self-host)

These three deployment modes have different trust boundaries.

## Decision

### Trust Model

#### Local desktop (packaged Electron)

The desktop app sets `DOPAFLOW_TRUST_LOCAL_CLIENTS=1` in the Electron runtime environment. This means:

- The bundled HTTP server only listens on `localhost`
- Any process running on the same machine can call the API without an API key
- No authentication is enforced between the bundled frontend and backend

**Rationale:** The desktop app runs in the user's own desktop session, with the user's own filesystem permissions. If a malicious process is already running as the same user, it already has full access to the user's data. Adding auth between the bundled frontend and backend would provide no additional security while adding complexity.

**What this does NOT protect against:**
- Malware running as the same user
- A compromised Electron renderer process (the preload is in the same process)
- Remote attackers (not applicable — server not exposed)

**What this DOES protect against:**
- Network-based attacks from other machines on the LAN (backend only listens on localhost)
- Accidental exposure if the user misconfigures the app to listen on all interfaces

#### Local development

`DOPAFLOW_DEV_AUTH=1` disables authentication entirely. This is only set in development, never in packaged builds. It allows developers to run the frontend against the backend without configuring API keys.

#### Remote / LAN exposure

When `DOPAFLOW_ENFORCE_AUTH=1` is set:

- All requests require `Authorization: Bearer <token>` header or `x-api-key` header
- The backend validates the token against `DOPAFLOW_API_KEY`
- Rate limiting applies per IP

This configuration is intended for users who expose the backend on a LAN (e.g., for multiple devices on a home network) or for users who run the backend separately from the Electron desktop app.

#### Cloud / remote hosting

Same as LAN configuration above, with `DOPAFLOW_ENFORCE_AUTH=1` always set. The backend should never be exposed on a public network without auth enforced.

### Auth token secret management

| Deployment | Auth mechanism | Secret source |
|---|---|---|
| Packaged desktop | `DOPAFLOW_TRUST_LOCAL_CLIENTS=1` | No secret needed |
| Packaged desktop (remote backend) | `x-api-key` | Set in `desktop/runtime-auth.js` |
| Local dev | `DOPAFLOW_DEV_AUTH=1` | No secret needed |
| LAN/remote self-host | `DOPAFLOW_ENFORCE_AUTH=1` | Env var `DOPAFLOW_API_KEY` |

### IPC security

The Electron preload script exposes only a minimal, explicitly allowlisted set of IPC channels:

**Send channels:** `df:install-update`, `open-path`, `open-journal`, `open-calendar`, `focus-completed`

**On channels:** `df:update-available`, `df:update-downloaded`, `df:build-info`, `notification-count`, `deep-link`, `alarm:due`, `focus-notification-shown`

All `open-path` payloads are validated against:
1. Must be a string
2. Must match `^#\/[a-z0-9-]+$` (no extra segments)
3. Route ID must be in the allowlist (22 known safe routes)
4. No `..` path traversal
5. No absolute paths

### External URL handling

External URLs (YouTube, etc.) are only opened through the system shell via `shell.openExternal()`, which prompts the OS default browser. No arbitrary URL execution from renderer.

### Deep links

Deep links (`dopaflow://`) are handled by a dedicated handler in the Electron main process. The handler validates the URL scheme and route before dispatching.

### Secrets and credentials

- OAuth tokens (Google Calendar) are stored in the SQLite database, not on disk in plaintext
- API keys are loaded from environment variables only
- No credentials are hardcoded anywhere in the codebase
- `check_repo_hygiene.py` fails the build on committed private key material

### Rate limiting

Rate limiting is enforced per-IP for unauthenticated endpoints. The rate limit storage uses SQLite by default (a separate `ratelimit.db` file). Rate limits can be disabled with `DOPAFLOW_DISABLE_RATE_LIMITS=1` for local testing.

### CSP

Content Security Policy is set on all responses:
```
default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'
```

### What is intentionally NOT in scope

- Multi-user authentication (single-user product)
- Encryption at rest (SQLite database is not encrypted — the desktop filesystem is the trust boundary)
- TLS for local communication (localhost is implicitly trusted by the OS)
- GDPR/compliance tooling (no cloud services, no user accounts, no data collection)

## Consequences

- Developers must understand that `DOPAFLOW_DEV_AUTH=1` is never safe for packaged builds
- Users who expose the backend on LAN must set `DOPAFLOW_ENFORCE_AUTH=1` and choose a strong API key
- The packaged desktop app is not safe to run on a shared machine where untrusted processes run as the same user
- No security auditing tool will catch the above — it requires developer discipline and documentation

## Review history

| Date | Change |
|---|---|
| 2026-04-13 | Initial security model ADR created after production hardening pass |
