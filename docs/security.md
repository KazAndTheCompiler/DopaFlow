# DopaFlow Security Assessment

**Date:** 2026-03-31
**Scope:** `/home/henry/vscode/build/dopaflow`
**Method:** code review of backend middleware, sensitive routers, upload paths, sharing flows, and existing middleware tests

## Executive summary

DopaFlow’s backend has a reasonable local-first baseline: security headers exist, local and remote traffic are separated in `AuthMiddleware`, uploads have some content checks, and there is a working rate-limit middleware with test coverage in `backend/tests/test_middleware.py`.

The larger issue is trust boundaries. Some meaningful gaps were closed in this pass: `calendar/feed` now validates bearer share tokens, peer-feed URLs reject local/private targets more aggressively, the sensitive ops endpoints are scoped, nearly the full non-public API surface now enforces `require_scope()` for remote clients, and those remote scope checks verify signed bearer tokens backed by a server-side issuance and revocation registry rather than trusting caller-asserted headers. As shipped, the codebase is in a much better place for staged network exposure than before, but it still needs stronger operator controls around token rotation and broader sharing hardening before it is ready for broad or hostile-network exposure.

**Current posture:** solid for local desktop use, substantially stronger for controlled network exposure, still not ready for hostile-network exposure.

## What is actually implemented

### 1. Security headers

`backend/app/middleware/security.py` adds:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

This is a solid browser baseline for the API responses. The CSP is still permissive on inline styles via `'unsafe-inline'`, which is tolerable for the current frontend but not ideal if the app gains more untrusted rendering paths.

### 2. Request authentication boundary

`backend/app/middleware/auth.py` does three things:

- exempts `/health`
- trusts requests from `app://`, `file://`, and loopback hosts
- optionally requires `x-api-key` for non-local requests when `DOPAFLOW_ENFORCE_AUTH` is enabled

That is a pragmatic local-desktop model. The weakness is that it is binary and coarse: once a request is considered local, it bypasses auth entirely.

### 3. Rate limiting

`backend/app/middleware/rate_limit.py` applies a SQLite-backed sliding window. `backend/tests/test_middleware.py` verifies:

- valid API key access
- rejection for bad or missing API keys
- health endpoint exemption
- 429 behavior after repeated requests
- a separate command bucket for `tasks/quick-add`

This is useful abuse protection for local HTTP surfaces, but it is not sufficient as a security control by itself.

### 4. Upload validation

`backend/app/services/upload_security.py` validates:

- presence of a filename
- size limit
- suffix allowlist
- content type allowlist when supplied
- magic bytes for a small set of formats

This is correctly used in the ops backup endpoints and review APKG import routes. It is not used consistently across all upload paths.

### 5. SQLite safety basics

`backend/app/core/database.py` enables:

- WAL mode
- foreign keys
- explicit transaction helper via `tx()`
- migration tracking through `_migrations`

This is good operational hygiene. It is not a substitute for authorization, audit logging, or encrypted storage.

## Key findings

### Critical

1. Scope enforcement is broadly in place, with a small number of intentional or legacy exceptions

`require_scope()` now covers the main product routers plus the smaller operational and assistant surfaces: tasks, projects, boards, habits, focus, review, journal, calendar, calendar sharing, alarms, nutrition, packy, player, insights, integrations, notifications, search, motivation, digest, commands, and ops.

Impact:
- remote callers now hit real read/write scope checks across the main product surface
- the authorization model is materially stronger than before because scopes are now bound to signed bearer tokens
- the remaining exceptions are mostly public introspection routes like `health` and `meta`, plus any future router additions that do not opt into the pattern

### High

2. Scoped remote access now uses signed, registry-backed bearer tokens, but operator controls still need hardening

`backend/app/middleware/auth_scopes.py` now verifies HMAC-signed bearer tokens with issuer, token ID, scope, and expiry claims. Issued tokens are stored in SQLite, tracked for last use, and rejected if revoked. `POST /ops/auth-tokens` can mint those tokens for remote use, `GET /ops/auth-tokens` can list them, and `DELETE /ops/auth-tokens/{id}` can revoke them.

Impact:
- the backend no longer trusts arbitrary caller-provided scope headers
- token issuance and revocation are now operable through the API instead of being purely implicit
- token rotation is still concentrated in an admin ops workflow rather than a fuller identity/session model
- per-user attribution and richer auditability are still limited

### High

3. Scope enforcement is consistent across the shipped non-public API, but token operations still need maturity

This pass extended scope protection across the remaining secondary routers as well, including commands, integrations, alarms, player, packy, search, digest, and motivation.

What remains:
- public introspection routes remain intentionally open
- the backend still relies on coarse local-trust for desktop traffic
- signed scope tokens now have first-class revocation and last-used tracking, but rotation workflows and user/session attribution are still limited

Impact:
- route coverage is no longer the main authz weakness
- the next auth hardening work is about token lifecycle and operator controls rather than adding `Depends(require_scope(...))` to more business endpoints

### Medium

4. Calendar feed auth is now enforced, but sharing still needs more hardening

`backend/app/domains/calendar/router.py` now validates bearer share tokens through `CalendarSharingService.validate_token()` before returning `calendar/feed`.

`backend/app/domains/calendar/router.py` and `backend/app/domains/calendar_sharing/service.py` now also agree on the actual feed contract shape, and peer sync pulls a bounded time window instead of making an underspecified request that silently failed to import anything useful.

Remaining issues:
- the feed contract still depends on token secrecy plus basic expiry alone
- there is no token audience or issuer model
- sharing is still read-only and deliberately simple, which is good for now but not enough for future broader user sharing
- the one-time raw share token is intentionally not recoverable after creation, so operational UX depends on the setup code shown at issue time rather than a later API lookup

### Medium

5. Peer-feed SSRF handling is better, but remote identity hardening still remains

`backend/app/domains/calendar_sharing/router.py` now rejects:

- non-http/https schemes
- embedded credentials
- localhost targets
- resolved private, loopback, link-local, multicast, reserved, and unspecified IPs

Remaining issues:
- there is no certificate pinning or remote identity model

### Medium

6. Upload handling is improved, but still not fully unified

Good:
- ops backup verify/restore use `validate_upload()`
- review APKG import uses `validate_upload()`
- task CSV import now uses `validate_upload()` with suffix, content-type, size, and UTF-8 decoding checks
- `backend/app/domains/journal/transcribe_router.py` now uses the shared upload validator

Weak:
- the duplicate transcription logic in `backend/app/domains/journal/router.py` still carries its own validation path
- file validation policy is still distributed rather than centralized behind a single upload abstraction

Impact:
- file handling policy is harder to reason about
- size/type checks may drift between endpoints

### Medium

7. Backup restore has integrity checks for format, not provenance

`backend/app/domains/ops/service.py` accepts any SQLite file with the expected header and swaps it into place. There is no signature, no checksum tied to a trusted exporter, and no schema compatibility gate during restore.

Impact:
- an operator can accidentally restore an incompatible or maliciously prepared database
- availability and data integrity are the primary risks here

### Low

8. Local secrets and databases are not encrypted at rest

The SQLite DB path from `backend/app/core/config.py` defaults to a normal user-writable location under `~/.local/share/DopaFlow/`. OAuth tokens and app data live in that database.

Impact:
- this is acceptable for many local desktop apps
- it offers no protection against local account compromise or disk theft

### Low

9. Auth config semantics are easy to misread

There is a mix of `DOPAFLOW_*` settings in `config.py` and `ZOESTM_*` compatibility checks in `auth_scopes.py` and parts of `ops/service.py`.

Impact:
- deployment mistakes are more likely
- operators may believe auth is enforced when only one side of the logic is configured

## Positive notes

- `backend/tests/test_middleware.py` gives the auth and rate-limit baseline real regression coverage.
- `backend/app/services/player.py` and the TTS/audio paths use argument arrays with `subprocess.run()` rather than shell strings, which avoids trivial command injection.
- `backend/app/core/database.py` wraps writes in transactions and logs rollback failures.
- Calendar share tokens are stored hashed in `backend/app/domains/calendar_sharing/repository.py`, which is the right storage model.

## Recommended remediation order

### Priority 0: required before broader network exposure

1. Add token rotation workflows and operator guidance around signed scope tokens.
2. Decide whether any currently public introspection routes should stay public in remote deployments.
3. Add stronger redirect and remote-identity controls to the sharing sync path.

### Priority 1: harden high-risk input surfaces

4. Standardize all file uploads on the shared validation helper.
5. Add restore-time schema/version validation before swapping in a backup DB.
6. Add stronger audit logging for token creation, revocation, feed sync failures, backup, restore, and export.

### Priority 2: operational hardening

7. Unify env-var names and remove ambiguous legacy fallbacks where possible.
8. Consider optional encryption-at-rest for tokens or the full SQLite DB if the deployment model expands.

## Concrete change list

If the goal is to harden this codebase next, the smallest defensible implementation sequence is:

1. Add `Depends(require_scope(...))` across all sensitive routers.
2. Add rotation workflows, richer auditability, and operator controls for signed scope tokens.
3. Move all upload endpoints onto `validate_upload()` with endpoint-specific allowlists.
4. Constrain redirects and outbound target validation in the sharing sync path itself, not just at create time.
5. Add tests for scoped router protections and share-feed auth flows.

## Bottom line

DopaFlow currently behaves like a trusted local app with some good safety primitives, not like a hardened network service. That is a coherent model for personal desktop use. It becomes risky the moment the backend is exposed to other machines or wider networks, because authorization coverage is incomplete and several sensitive paths trust caller-controlled input too far.
