# Frontend Type Fix Prompt

## Context
DopaFlow frontend has TypeScript type mismatches between the shared types in `/shared/types.ts` and the actual frontend code usage. The types have been extended to accommodate frontend needs, but there are still ~50 type errors that require code-level fixes.

## Current Status
- ✅ Repo Hygiene CI: PASSING
- ✅ Security vulnerabilities: FIXED (Electron 41, PostCSS updated)
- ⚠️ Frontend CI: FAILING with ~50 TypeScript errors
- 🔄 Temporarily disabled strict TypeScript to pass CI (Option A)
- 📝 This prompt is for Option B/C: Properly fix the type mismatches

## Error Categories to Fix

### 1. ReviewCard Property Mismatches (15 errors)
**Issue**: Frontend uses `front`/`back`, types use `question`/`answer`

**Files affected**:
- `src/surfaces/review/CardEditModal.tsx` (lines 22, 23, 81)
- `src/surfaces/review/CardReviewer.tsx` (lines 351, 354, 356)
- `src/surfaces/review/ReviewStats.tsx` (lines 17, 27, 30)
- `src/surfaces/review/index.tsx` (lines 20, 26, 114, 117, 118)

**Fix approach** (choose one):
- **Option B1**: Update frontend code to use `question`/`answer`
  ```typescript
  // Change from:
  card.front, card.back
  // To:
  card.question, card.answer
  ```
- **Option B2**: Add aliases to shared types (already done: `front?`, `back?`)
- **Option C**: Create adapter layer in frontend to map between naming conventions

### 2. Missing ReviewCard Properties (5 errors)
**Missing properties**:
- `deck_id` - used in `src/surfaces/review/index.tsx:20`
- `next_review_at` - used in multiple files (lines 26, 114, 117, 118)
- `interval` - used in `ReviewStats.tsx:30`
- `ease_factor` - used in `ReviewStats.tsx:27`

**Fix**: Add to shared types or update frontend to use existing properties:
```typescript
// Add to ReviewCard interface:
deck_id?: string;
next_review_at?: string;  // alias for next_review_date
interval?: number;        // alias for interval_days
ease_factor?: number;
```

### 3. Notification Level Record Error (1 error)
**Issue**: `src/components/NotificationInbox.tsx:16` - 'alarm' property doesn't exist in notification level record

**Fix**: Add 'alarm' to the level record type or update the component

### 4. VoiceCommandModal Type Casting (3 errors)
**Issues**:
- Line 472: Unsafe conversion to `{ results: PackyVoiceResponse[] }`
- Missing proper type guards for voice response handling

**Fix**: Add proper type checking:
```typescript
// Instead of unsafe cast:
const response = data as { results: PackyVoiceResponse[] };

// Use type guards:
if ('results' in data && Array.isArray(data.results)) {
  const response = data as { results: PackyVoiceResponse[] };
}
```

### 5. Arithmetic Type Errors (5 errors)
**Issue**: String/number comparisons in:
- `src/surfaces/calendar/CalendarDaySidebar.tsx` (lines 321, 322)
- `src/surfaces/calendar/SyncConflictModal.tsx` (lines 129, 139)
- `src/surfaces/overview/index.tsx` (line 176)
- `src/surfaces/plan/PlanMyDayModal.tsx` (lines 62, 133)
- `src/surfaces/search/index.tsx` (line 125)
- `src/hooks/useTasks.ts` (line 116)

**Fix**: Parse strings to numbers before comparison:
```typescript
// Change from:
if (a <= b)  // where a or b is string

// To:
if (Number(a) <= Number(b))
// or:
if (parseInt(a, 10) <= parseInt(b, 10))
```

### 6. Missing Settings/Integration Properties (25 errors)
**Files**: Various settings components

**Missing types**:
- `IntegrationsStatus`: `gmail_connected`, `webhooks_enabled`, `webhook_retry_wait`, `webhook_pending`, `webhook_sent`
- `VaultStatus`: `config`, `vault_reachable`, `conflicts`, `total_indexed`
- `VaultFileRecord`: `id`, `file_path`, `entity_type`, `entity_id`, `last_direction`, `last_synced_at`, `diff_lines`
- `VaultConflictPreview`: `diff_lines`
- `ShareToken`: `last_used_at`
- `ShareTokenCreated`: `raw_token`, `expires_at`
- `PeerFeed`: `base_url`
- `PeerFeedSyncResult`: `events_imported`, `detail`

**Fix**: Add all missing properties to shared types or create separate frontend-specific extension types

### 7. AppOverlays Type Error (1 error)
**Issue**: Line 87 - Type 'number' not assignable to priority union type

**Fix**: Ensure priority values are typed correctly:
```typescript
// Use proper literal type:
const priority: 'low' | 'medium' | 'high' | 'urgent' = someValue;
// or cast:
const priority = someValue as Task['priority'];
```

## Implementation Strategy

### Phase 1: Critical Path (get CI green)
1. Fix arithmetic errors (affects runtime behavior)
2. Add missing type guards for VoiceCommandModal
3. Fix NotificationInbox record type

### Phase 2: Property Alignment
1. Decide on naming convention for ReviewCard (front/back vs question/answer)
2. Add missing optional properties to shared types
3. Create frontend type extensions where needed

### Phase 3: Long-term Type Safety
1. Gradually re-enable strict TypeScript checks
2. Add runtime type validation with zod/io-ts
3. Consider generating types from OpenAPI spec

## Files to Modify

### Shared Types (`/shared/types.ts`)
```typescript
// Add these properties:

interface ReviewCard {
  // ... existing ...
  deck_id?: string;
  next_review_at?: string;
  interval?: number;
  ease_factor?: number;
  front?: string;  // alias
  back?: string;   // alias
}

interface IntegrationsStatus {
  // ... existing ...
  gmail_connected?: boolean;
  webhooks_enabled?: boolean;
  webhook_retry_wait?: number;
  webhook_pending?: number;
  webhook_sent?: number;
}

interface VaultStatus {
  // ... existing ...
  config?: unknown;
  vault_reachable?: boolean;
  conflicts?: number;
  total_indexed?: number;
}

interface VaultFileRecord {
  id?: string;
  file_path?: string;
  entity_type?: string;
  entity_id?: string;
  last_direction?: 'push' | 'pull';
  last_synced_at?: string;
}

interface VaultConflictPreview {
  // ... existing ...
  diff_lines?: number;
}

interface ShareToken {
  // ... existing ...
  last_used_at?: string;
}

interface ShareTokenCreated {
  // ... existing ...
  raw_token?: string;
  expires_at?: string;
}

interface PeerFeed {
  // ... existing ...
  base_url?: string;
}

interface PeerFeedSyncResult {
  // ... existing ...
  events_imported?: number;
  detail?: string;
}
```

### Frontend Components
1. `src/surfaces/calendar/CalendarDaySidebar.tsx` - Fix arithmetic
2. `src/surfaces/calendar/SyncConflictModal.tsx` - Fix arithmetic  
3. `src/surfaces/overview/index.tsx` - Fix arithmetic
4. `src/surfaces/plan/PlanMyDayModal.tsx` - Fix arithmetic
5. `src/surfaces/search/index.tsx` - Fix arithmetic
6. `src/hooks/useTasks.ts` - Fix comparison
7. `src/components/VoiceCommandModal.tsx` - Add type guards
8. `src/components/NotificationInbox.tsx` - Fix notification levels
9. `src/app/AppOverlays.tsx` - Fix priority typing
10. All review-related files - Align property names

## Testing Checklist
- [ ] TypeScript compilation passes: `cd frontend && npm run typecheck`
- [ ] ESLint passes: `npm run lint`
- [ ] Frontend CI passes on GitHub
- [ ] No runtime regressions (manual smoke test)
- [ ] Shared types still work with backend

## Notes
- Most of these errors are due to frontend code evolving faster than shared types
- The shared types were designed for backend API responses
- Frontend has additional UI-specific properties that don't exist in backend
- Consider splitting types into: `api-types.ts` (backend) and `ui-types.ts` (frontend extensions)
