# DopaFlow v2 — Backend API Reference

Base URL: `/api/v2`

All endpoints accept and return JSON. Local desktop traffic uses the built-in local trust boundary; remote scoped routes require a signed bearer token.

---

## Tasks

| Method | Path | Notes |
|--------|------|-------|
| GET | `/tasks` | List tasks. Params: `done`, `status`, `no_date`, `due_today`, `search`, `project_id`, `limit`, `offset`, `sort_by` |
| POST | `/tasks` | Create task |
| GET | `/tasks/{id}` | Get single task |
| PATCH | `/tasks/{id}` | Update task |
| DELETE | `/tasks/{id}` | Delete task |
| PATCH | `/tasks/{id}/complete` | Mark complete |
| GET | `/tasks/{id}/context` | Get task context (dependencies, related) |
| POST | `/tasks/{id}/deps/{dep_id}` | Add dependency |
| DELETE | `/tasks/{id}/deps/{dep_id}` | Remove dependency |
| POST | `/tasks/{id}/subtasks` | Add subtask |
| PATCH | `/tasks/{id}/subtasks/{sub_id}` | Update subtask |
| DELETE | `/tasks/{id}/subtasks/{sub_id}` | Delete subtask |
| POST | `/tasks/{id}/time/start` | Start time log |
| POST | `/tasks/{id}/time/stop` | Stop time log |
| GET | `/tasks/{id}/time` | Get time logs |
| GET | `/tasks/search` | Search by query, tag, priority, due_before |
| GET | `/tasks/tomorrow` | Tasks due tomorrow |
| GET | `/tasks/templates` | List templates |
| POST | `/tasks/templates` | Create template |
| DELETE | `/tasks/templates/{id}` | Delete template |
| POST | `/tasks/from-template/{id}` | Create task from template |
| POST | `/tasks/quick-add` | Quick-add with NLP text parsing |
| POST | `/tasks/materialize-recurring` | Materialize recurring tasks within window |
| POST | `/tasks/bulk/complete` | Bulk complete |
| POST | `/tasks/bulk/delete` | Bulk delete |
| POST | `/tasks/import/csv` | Import from CSV |
| GET | `/tasks/export/csv` | Export to CSV |

---

## Habits

| Method | Path | Notes |
|--------|------|-------|
| GET | `/habits` | List all habits |
| POST | `/habits` | Create habit |
| PATCH | `/habits/{id}` | Update habit |
| DELETE | `/habits/{id}` | Delete habit |
| GET | `/habits/today` | Today's habits summary |
| GET | `/habits/weekly` | Weekly overview |
| GET | `/habits/insights` | Insights (7/14/30-day windows) |
| GET | `/habits/goals/summary` | Goals summary |
| GET | `/habits/correlations` | Habit-mood correlations |
| POST | `/habits/{id}/checkin` | Check in |
| DELETE | `/habits/{id}/checkin/{date}` | Delete checkin |
| GET | `/habits/{id}/logs` | Get logs |
| GET | `/habits/{id}/export/csv` | Export logs to CSV |
| PATCH | `/habits/{id}/freeze` | Freeze until date |
| PATCH | `/habits/{id}/unfreeze` | Unfreeze |

---

## Focus

| Method | Path | Notes |
|--------|------|-------|
| POST | `/focus/sessions` | Start session |
| GET | `/focus/sessions` | List recent sessions |
| POST | `/focus/sessions/control` | Control session (pause/resume/complete/stop) |
| POST | `/focus/start` | Start (convenience) |
| POST | `/focus/pause` | Pause |
| POST | `/focus/resume` | Resume |
| POST | `/focus/stop` | Stop |
| POST | `/focus/complete` | Complete |
| GET | `/focus/status` | Current session status |
| GET | `/focus/history` | Session history |
| GET | `/focus/stats` | Statistics |
| GET | `/focus/recommendation` | AI focus recommendation |

---

## Journal

| Method | Path | Notes |
|--------|------|-------|
| GET | `/journal/entries` | List entries. Params: `tag`, `search`, `limit`, `offset` |
| POST | `/journal/entries` | Save entry |
| GET | `/journal/entries/{id}` | Get entry |
| PATCH | `/journal/entries/{id}` | Update entry |
| DELETE | `/journal/entries/{id}` | Delete entry |
| PATCH | `/journal/entries/{id}/lock` | Lock entry |
| PATCH | `/journal/entries/{id}/unlock` | Unlock entry |
| GET | `/journal/entries/{id}/versions` | List versions |
| GET | `/journal/entries/{id}/versions/{n}` | Get version N |
| GET | `/journal/analytics/summary` | Analytics summary (configurable days) |
| GET | `/journal/analytics/heatmap` | Heatmap for year |
| GET | `/journal/auto-tags/stats` | Auto-tag statistics |
| GET | `/journal/search` | Search (q, mood, limit) |
| GET | `/journal/prompt/{date}` | Prompt for date |
| GET | `/journal/export/range` | Export range (markdown/json/zip) |
| GET | `/journal/export/zip` | Export as ZIP |
| POST | `/journal/to-card` | Convert entry to review card |
| POST | `/journal/transcribe` | Transcribe audio |
| GET | `/journal/graph` | Wikilink graph data |
| GET | `/journal/{id}/backlinks` | Backlinks for entry |
| GET | `/journal/backup-status` | Backup status |
| POST | `/journal/backup/trigger` | Trigger backup |
| POST | `/journal/export-today` | Export today's entry |
| GET | `/journal/templates` | List templates |
| POST | `/journal/templates` | Create template |
| GET | `/journal/templates/{id}` | Get template |
| PATCH | `/journal/templates/{id}` | Update template |
| DELETE | `/journal/templates/{id}` | Delete template |
| POST | `/journal/templates/{id}/apply` | Return template body and tags for editor prefill |

---

## Review

| Method | Path | Notes |
|--------|------|-------|
| GET | `/review/cards` | List all cards |
| POST | `/review/cards` | Create card |
| POST | `/review/cards/{id}/suspend` | Suspend |
| POST | `/review/cards/{id}/unsuspend` | Unsuspend |
| POST | `/review/cards/{id}/bury-today` | Bury for today |
| POST | `/review/cards/{id}/reset` | Reset |
| GET | `/review/decks` | List decks |
| POST | `/review/decks` | Create deck |
| PATCH | `/review/decks/{id}` | Rename deck |
| DELETE | `/review/decks/{id}` | Delete deck |
| POST | `/review/decks/{id}/cards` | Create card in deck |
| GET | `/review/decks/{id}/cards/search` | Search cards in deck |
| POST | `/review/decks/{id}/cards/bulk` | Bulk card operations |
| GET | `/review/decks/{id}/next-due` | Next due card |
| GET | `/review/decks/{id}/stats` | Deck statistics |
| POST | `/review/decks/{id}/import/preview` | Preview import |
| GET | `/review/due` | Due cards |
| POST | `/review/rate` | Rate card |
| GET | `/review/session` | Session state |
| POST | `/review/session/start` | Start session |
| POST | `/review/session/{deck_id}/start` | Start deck session |
| POST | `/review/answer` | Answer card |
| POST | `/review/session/{deck_id}/answer` | Answer in deck session |
| POST | `/review/session/{deck_id}/end` | End deck session |
| GET | `/review/history` | Review history |
| GET | `/review/export/apkg/{deck_id}` | Export as APKG |
| POST | `/review/import` | Import CSV/TSV |
| POST | `/review/import-apkg` | Import APKG |

---

## Alarms

| Method | Path | Notes |
|--------|------|-------|
| GET | `/alarms` | List alarms |
| POST | `/alarms` | Create alarm |
| GET | `/alarms/upcoming` | Upcoming alarms |
| GET | `/alarms/scheduler/status` | Scheduler status |
| POST | `/alarms/resolve-url` | Resolve YouTube URL to audio stream |
| GET | `/alarms/{id}` | Get alarm |
| PATCH | `/alarms/{id}` | Update alarm |
| DELETE | `/alarms/{id}` | Delete alarm |
| POST | `/alarms/{id}/trigger` | Manually trigger (TTS) |
| POST | `/alarms/{id}/trigger-audio` | Trigger audio playback |

---

## Calendar

| Method | Path | Notes |
|--------|------|-------|
| GET | `/calendar/events` | List events. Params: `from`, `to`, `category` |
| POST | `/calendar/events` | Create event |
| GET | `/calendar/events/{id}` | Get event |
| PATCH | `/calendar/events/{id}` | Update event |
| DELETE | `/calendar/events/{id}` | Delete event |
| POST | `/calendar/events/{id}/move` | Move event by `delta_minutes` |
| GET | `/calendar/feed` | Feed contract for shared calendar pulls. Requires `Authorization: Bearer <share_token>` plus `from` and `to` params |
| GET | `/calendar/today` | Today's events |
| POST | `/calendar/google/sync` | Queue Google Calendar sync |
| GET | `/calendar/oauth/url` | Google OAuth URL |
| GET | `/calendar/oauth/callback` | Google OAuth callback |
| GET | `/calendar/sync/conflicts` | List sync conflicts |
| POST | `/calendar/sync/conflicts/{id}/resolve` | Resolve conflict. Body: `{ resolution: "prefer_local" | "prefer_incoming" }` |
| GET | `/calendar/sync/status` | Sync status |

### Calendar Sharing

| Method | Path | Notes |
|--------|------|-------|
| GET | `/calendar/sharing/tokens` | List active share tokens |
| POST | `/calendar/sharing/tokens` | Create a one-time share token. Accepts optional `expires_in_days`; the response is the only time the raw token is returned |
| DELETE | `/calendar/sharing/tokens/{id}` | Revoke a share token |
| GET | `/calendar/sharing/tokens/{id}/invite` | Returns token metadata plus a non-secret stub. It cannot recreate the one-time raw token after creation |
| GET | `/calendar/sharing/feeds` | List subscribed peer feeds |
| POST | `/calendar/sharing/feeds` | Add a peer feed. Rejects localhost/private-network targets, validates the remote payload shape, performs an initial sync validation, and returns the specific sync failure reason on 422 |
| PATCH | `/calendar/sharing/feeds/{id}` | Update a peer feed |
| DELETE | `/calendar/sharing/feeds/{id}` | Remove a peer feed |
| POST | `/calendar/sharing/feeds/{id}/sync` | Manually sync a peer feed over the current import window. Response includes `status` and optional `detail` on failure |

Notes:
- The current product flow uses a setup code of the form `<base_url>|<raw_share_token>` in the UI. That setup code is generated client-side from the token creation response and is not recoverable later from the API.
- Share tokens are active only while non-revoked and non-expired.
- Peer feed sync currently imports a rolling window around the present rather than full historical calendar data.
- Imported peer events land in the main calendar as read-only mirrored events with `source_type = peer:{feed_id}`.

---

## Commands

| Method | Path | Notes |
|--------|------|-------|
| POST | `/commands/parse` | Parse command string (no execution) |
| POST | `/commands/preview` | Dry-run preview |
| POST | `/commands/execute` | Parse and execute |
| GET | `/commands/history` | Recent command logs |
| DELETE | `/commands/history` | Clear history |
| GET | `/commands/list` | Available command definitions |

---

## Digest

| Method | Path | Notes |
|--------|------|-------|
| GET | `/digest/today` | Daily digest |
| GET | `/digest/week` | Weekly digest |

---

## Gamification

| Method | Path | Notes |
|--------|------|-------|
| GET | `/gamification/status` | Level, badges, earned count |
| GET | `/gamification/badges` | All badges |
| POST | `/gamification/award` | Award XP. Body: `{ source, source_id?, xp }` |

---

## Nutrition

| Method | Path | Notes |
|--------|------|-------|
| GET | `/nutrition/foods` | Food library |
| POST | `/nutrition/foods` | Create custom food |
| DELETE | `/nutrition/foods/{id}` | Delete food |
| GET | `/nutrition/log` | Log by date |
| GET | `/nutrition/log/monthly` | Monthly log |
| POST | `/nutrition/log` | Log food entry |
| POST | `/nutrition/log/from-food` | Log from library |
| DELETE | `/nutrition/log/{id}` | Delete log entry |
| GET | `/nutrition/summary/{date}` | Daily summary |
| GET | `/nutrition/goals` | Nutrition goals |
| POST | `/nutrition/goals` | Set goals |
| GET | `/nutrition/export/csv` | Export (date range) |
| GET | `/nutrition/today` | Today's totals |
| GET | `/nutrition/history` | History for date |
| GET | `/nutrition/recent` | Recent food items |

---

## Packy (Memory Support)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/packy/ask` | Ask Packy. Body: `{ text, context? }` |
| GET | `/packy/whisper` | Proactive tip |
| POST | `/packy/lorebook` | Update contextual lorebook |
| GET | `/packy/momentum` | Momentum score |

---

## Search

| Method | Path | Notes |
|--------|------|-------|
| GET | `/search` | Cross-domain search. Params: `q`, `types`, `from`, `to` |

---

## Notifications

| Method | Path | Notes |
|--------|------|-------|
| GET | `/notifications` | List. Params: `archived`, `level`, `limit` |
| POST | `/notifications` | Create notification |
| GET | `/notifications/unread-count` | Unread count |
| POST | `/notifications/{id}/read` | Mark read |
| POST | `/notifications/read-all` | Mark all read |
| POST | `/notifications/{id}/archive` | Archive |
| DELETE | `/notifications/{id}` | Delete |

---

## Boards

| Method | Path | Notes |
|--------|------|-------|
| GET | `/boards/kanban` | Kanban columns |
| GET | `/boards/eisenhower` | Eisenhower matrix |
| GET | `/boards/matrix-data` | Raw matrix data |

---

## Insights

| Method | Path | Notes |
|--------|------|-------|
| GET | `/insights/momentum` | Momentum score |
| GET | `/insights/weekly-digest` | Weekly digest |
| GET | `/insights/correlations` | Habit-mood and cross-domain correlations |

---

## Projects

| Method | Path | Notes |
|--------|------|-------|
| GET | `/projects` | List. Params: `include_archived` |
| POST | `/projects` | Create project |
| PATCH | `/projects/{id}` | Update project |
| DELETE | `/projects/{id}` | Delete project |
| GET | `/projects/task-counts` | Task counts per project |

---

## Player

| Method | Path | Notes |
|--------|------|-------|
| POST | `/player/resolve-url` | Resolve YouTube/audio URL |
| GET | `/player/queue` | Get queue |
| POST | `/player/queue` | Save queue |
| POST | `/player/queue/next` | Play next track |
| POST | `/player/predownload/enqueue` | Enqueue predownload |
| GET | `/player/predownload/status` | Predownload status |
| POST | `/player/predownload/retry/{job_id}` | Retry job |
| POST | `/player/predownload/tick/{job_id}` | Tick job |

---

## Integrations

| Method | Path | Notes |
|--------|------|-------|
| POST | `/gmail/connect` | Initiate Gmail OAuth |
| POST | `/gmail/import` | Import tasks from Gmail |
| GET | `/gmail/callback` | Gmail OAuth callback |
| POST | `/github/import-issues` | Import GitHub issues as tasks |
| POST | `/webhooks/outbox` | Queue a webhook event |
| GET | `/outbox/metrics` | Webhook outbox metrics |
| POST | `/outbox/dispatch` | Dispatch pending outbox events |

---

## Health

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Liveness check (status, version) |
| GET | `/health/detail` | Detailed health payload |

---

## Meta

| Method | Path | Notes |
|--------|------|-------|
| GET | `/meta` | App metadata (version, schema version) |
| GET | `/meta/version` | Version only |
| GET | `/meta/openapi` | OpenAPI schema |

---

## Ops

| Method | Path | Notes |
|--------|------|-------|
| GET | `/ops/stats` | Entity counts across key domains |
| GET | `/ops/sync-status` | DB size and sync diagnostics |
| GET | `/ops/config` | Safe runtime config |
| POST | `/ops/turso-test` | Test Turso libsql connection. Admin-scoped ops endpoint |
| POST | `/ops/auth-tokens` | Issue a signed bearer token for remote scoped API access. Admin-scoped ops endpoint |
| GET | `/ops/auth-tokens` | List issued remote scope tokens, including expiry, last-used, and revocation state. Admin-scoped ops endpoint |
| DELETE | `/ops/auth-tokens/{id}` | Revoke an issued remote scope token. Admin-scoped ops endpoint |
| GET | `/ops/export` | Full JSON export with checksum |
| GET | `/ops/export/download` | Download export as JSON file |
| GET | `/ops/export/all` | Download full export as ZIP |
| GET | `/ops/backup/db` | Download live SQLite backup |
| POST | `/ops/backup/verify` | Verify a backup file |
| POST | `/ops/restore/db` | Restore from backup |
| POST | `/ops/seed` | Seed sample data (no-op if data exists). Write-scoped ops endpoint |
| POST | `/ops/import` | Import a previously exported package |
| POST | `/ops/integrations/reconcile` | Trigger webhook outbox reconciliation |

Remote scoped routes now expect `Authorization: Bearer <signed_scope_token>`. Signed scope tokens are issued through `/ops/auth-tokens`, tracked in the backend registry, and can be listed or revoked through the same ops surface. Local desktop traffic still uses the built-in local trust boundary.
