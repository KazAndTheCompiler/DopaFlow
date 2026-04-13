# Error Taxonomy

## API error responses

All DopaFlow API errors follow FastAPI's `HTTPException` convention with a consistent JSON shape.

### Standard error shape

```json
{
  "detail": "Human-readable error message"
}
```

For validation errors (422):

```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "field required",
      "type": "missing"
    }
  ]
}
```

### Auth errors

```json
{ "detail": "Unauthorized" }                    // 401
{ "detail": "Forbidden" }                      // 403
```

Auth scope errors use a structured shape:

```json
{
  "detail": {
    "code": "missing_token",
    "message": "No authorization token provided"
  }
}
```

| Code | Meaning |
|---|---|
| `missing_token` | No `Authorization: Bearer <token>` header |
| `invalid_token` | Token present but invalid or expired |
| `insufficient_scope` | Token valid but lacks required scope for this endpoint |

### Rate limit errors

```json
{
  "detail": {
    "code": "rate_limit_exceeded",
    "retry_after": 60
  }
}
```

When rate limit storage is unavailable (503):

```json
{
  "detail": {
    "code": "rate_limit_unavailable",
    "message": "Rate limit service unavailable"
  }
}
```

### Common HTTP status codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 204 | Success, no content |
| 400 | Bad request (malformed JSON, invalid parameters) |
| 401 | Unauthorized (missing or invalid auth) |
| 403 | Forbidden (valid auth but insufficient scope) |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate resource) |
| 422 | Validation error (Pydantic validation failure) |
| 429 | Rate limited |
| 500 | Internal server error |
| 503 | Service unavailable (rate limit storage down, or backend overloaded) |

### Frontend error handling

The API client (`frontend/src/api/client.ts`) normalizes errors:

- Network failures → `Error("network_error:...")` — toast: "Network error — the local release backend is unreachable."
- 429 → `Error("rate_limited")` — toast: "Too many requests — slow down a moment."
- 5xx → `Error("server_error:...")` — toast: "Server error — check the backend is running."
- 4xx → `Error("API request failed: {status} {detail}")` — no toast (handled inline)

## Logging levels by error class

| Error class | Log level |
|---|---|
| Startup DB unreachable | `CRITICAL` + process exit |
| Migration failure | `ERROR` + rollback |
| Auth rejection (invalid token) | `WARNING` |
| Rate limit triggered | Response only (no log spam) |
| Slow request (>200ms) | `WARNING` with structured JSON |
| Request error (exception) | `exception` with request context |
| PackyWhisper parse failure | `WARNING` (failsafe to `neutral`) |
| YouTube resolution failure | `WARNING` with URL context |

## What is NOT an error

- Empty list responses (`[]`) — legitimate, not errors
- 204 No Content — legitimate, not errors
- 422 on partial Pydantic validation — expected for PATCH with optional fields
- `needs_datetime` clarification status — not an HTTP error, a valid response state
