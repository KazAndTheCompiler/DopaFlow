# Security Model

## Supported runtime modes

| Mode | Configuration | Trust assumption |
|---|---|---|
| **Local desktop** | `DOPAFLOW_TRUST_LOCAL_CLIENTS=1` | Any process on the same machine is trusted |
| **Local dev** | `DOPAFLOW_DEV_AUTH=1` | Auth disabled for development |
| **LAN** | `DOPAFLOW_ENFORCE_AUTH=1` + API key | Requests from LAN must supply `x-api-key` header |
| **Remote / hosted** | `DOPAFLOW_ENFORCE_AUTH=1` + API key | All requests must be authenticated |

## Local desktop trust

When packaged as an Electron app, `DOPAFLOW_TRUST_LOCAL_CLIENTS=1` is set in the desktop runtime. This allows the bundled frontend (served from `localhost`) to call the bundled backend without authentication.

**This is safe because:**
- The backend only listens on `localhost` inside the packaged app
- No network interface is exposed outside the desktop session
- The Electron shell runs in the user's desktop session with their credentials

**This is NOT safe for:**
- Multi-user systems where untrusted processes run as the same user
- Remote desktop scenarios where a different machine connects to the desktop host
- Any scenario where the packaged app is exposed on a non-loopback network interface

## Auth middleware behavior

1. Health paths (`/health`, `/health/live`, `/health/ready`) are always accessible
2. If `DOPAFLOW_DEV_AUTH=1`, all requests pass through without auth
3. If the request host is loopback (`127.0.0.1`, `localhost`, `::1`) AND `DOPAFLOW_TRUST_LOCAL_CLIENTS=1`, auth is bypassed
4. If `DOPAFLOW_ENFORCE_AUTH=1`, requests must include `x-api-key: <token>` matching `DOPAFLOW_API_KEY`

## Dev-only auth shortcuts

`DOPAFLOW_DEV_AUTH=1` must never be set in packaged/production builds. The Electron desktop shell does not set this variable. Only use it in local development.

## Rate limiting

`DOPAFLOW_DISABLE_RATE_LIMITS=1` disables rate limiting for local testing. Do not use in production.

## IPC security (desktop)

The Electron preload script only exposes a minimal, validated subset of IPC channels:

**Allowed `send` channels:** `df:install-update`, `open-path`, `open-journal`, `open-calendar`, `focus-completed`

**Allowed `on` channels:** `df:update-available`, `df:update-downloaded`, `df:build-info`, `notification-count`, `deep-link`, `alarm:due`, `focus-notification-shown`

All `open-path` payloads are validated against an allowlist of route IDs and reject absolute paths, `..`, and non-route patterns.

## External URL handling

The Electron shell only opens external URLs through explicitly allowlisted channels. No arbitrary URL execution from renderer process.

**Desktop navigation security:**

The BrowserWindow is configured with:
- `contextIsolation: true` — renderer cannot access Electron internals
- `nodeIntegration: false` — no Node.js in renderer
- `sandbox: true` — renderer is sandboxed

**Navigation allowlist (`isTrustedNavigationUrl`):**

| Mode | Allowed URLs |
|---|---|
| Packaged | `file://` pointing to bundled frontend dist directory only |
| Dev | Same origin as `http://127.0.0.1:5173` only |
| Both | `about:blank` |

Any navigation outside these is denied and opened via `shell.openExternal()` in the system's default browser.

**Deep links (`dopaflow://`):**

The app registers as the `dopaflow://` protocol handler via `setAsDefaultProtocolClient("dopaflow")`. Deep links are parsed and validated:
- Must parse as a URL with protocol `dopaflow:`
- Route segments validated against `SAFE_HASH_ROUTE` regex: `^#\/[a-z0-9/_-]*$`
- Invalid deep links fall back to `#/today`
- No arbitrary shell execution from deep link payloads

## Secrets handling

- Never commit `.env` files or private keys
- Use `.env.example` for documenting required env vars
- API tokens, OAuth credentials, and database URLs are loaded from environment at runtime
- The hygiene check (`scripts/check_repo_hygiene.py`) fails on any committed private key material
