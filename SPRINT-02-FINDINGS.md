# Sprint 02 Findings (Admin & Scheduling Characterization, Testing, Refactoring)

## Characterized and Tested

- Added `src/lib/stores/useScheduleStore.test.ts` coverage for:
  - Admin gate behavior for unauthenticated and non-admin users
  - Admin scheduling success path
  - Scheduled/completed album split behavior
  - Delete flow local-state update behavior
- Expanded `src/lib/services/scheduledAlbumService.test.ts` coverage for:
  - `getScheduledAlbums()` status refresh/read behavior
  - Replace-existing scheduling flow
  - Track insert failure rollback behavior
  - Update-date conflict behavior
  - Delete error passthrough behavior
- Added SQL characterization/assertion tests for Sprint 02 migration:
  - `supabase/migrations/20260227110000_sprint02_admin_scheduling_cleanup.test.ts`

All tests are green with Sprint 01 + Sprint 02 together (`51 passed`).

## Refactored and Why

- `src/lib/stores/useScheduleStore.ts`
  - Reduced repeated error-mapping logic by centralizing action error handling.
  - Removed noisy debug logging and preserved existing toast/error message behavior.
  - Kept admin authorization checks in place for schedule/update/delete operations.
- `src/lib/services/scheduledAlbumService.ts`
  - Removed debug leftovers and normalized unknown error handling.
  - Switched optional field mapping to nullish coalescing (`??`) for safer payload conversion.
  - Made `statusFilter` functional in `getScheduledAlbums()` (it was previously ignored).
  - Removed redundant `status` insert payload field and relied on DB-side status computation/trigger.
- `src/lib/stores/useAuthStore.ts`
  - Removed non-essential console logging while keeping behavior unchanged.

## Database Changes (Sprint 02 Migration)

Added migration:
- `supabase/migrations/20260227110000_sprint02_admin_scheduling_cleanup.sql`

This migration:
- Keeps `scheduled_albums` SELECT policy intentionally public via `USING (true)` for future visibility.
- Aligns status model to `pending/current/completed`:
  - Updates status check constraint
  - Updates `compute_album_status()` to return `current` for `CURRENT_DATE`
  - Rebuilds `trg_set_album_status` as `BEFORE INSERT OR UPDATE`
- Drops all `get_song_votes` function overloads (legacy dead function).
- Keeps canonical `is_admin(id UUID)` and drops non-canonical overloads.
- Ensures `handle_scheduled_album_deletion` trigger exists and remains a no-op.

## Decisions on Required Investigation Items

1. **Future album visibility**
   - Decision: keep public read visibility for future-dated scheduled albums.
   - Implementation: explicit policy `Anyone can view scheduled albums` with `USING (true)`.
   - Rationale: preserves admin preview workflows; user-facing hiding can remain a UI concern.

2. **`handle_scheduled_album_deletion` no-op**
   - Decision: keep no-op behavior.
   - Implementation: function remains `RETURN OLD;` and delete trigger is explicitly present.
   - Rationale: safe placeholder until weekend aggregation/deletion side effects are introduced.

3. **`get_song_votes` references removed columns**
   - Decision: drop function as dead/unsafe legacy.
   - Implementation: migration drops all `public.get_song_votes(...)` overloads dynamically.

4. **`sync_puzzle_settings_to_current_date` naming**
   - Decision: defer rename in this sprint.
   - Rationale: rename risk to unknown callers is higher than value in Sprint 02; behavior remains safe.
   - Note: recommended future rename with compatibility alias in a dedicated migration.

5. **Two `is_admin` overloads**
   - Decision: keep only `is_admin(id UUID)`.
   - Implementation: migration recreates canonical function and removes other overloads.
   - Frontend usage confirmed: app calls `rpc('is_admin', { id: userId })`.

## Low-Urgency Advisor Notes (Retained by Design)

Retained indexes and documented rationale:
- `idx_song_votes_scheduled_date`
- `idx_song_votes_scheduled_track_id`
- `idx_scheduled_albums_created_by`

Reason: currently low hit rate due data volume, but expected to matter at scale and for later aggregation work.

## Supabase Auth Dashboard Actions

These are **manual dashboard tasks** and cannot be enforced in repository code:
- OTP expiry must be set to under 1 hour.
- Leaked password protection must be enabled.

Current sprint status for these items: **pending manual confirmation**.

## Fragilities / Technical Debt

- Scheduling/service/store logic still spans multiple layers (UI/store/service), which increases duplicate guard/error pathways.
- Some UI orchestration modules remain lightly tested compared to service/store layers.
- `sync_puzzle_settings_to_current_date` naming remains misleading until dedicated rename/compat migration is done.

## Deferred Items

- Function rename for `sync_puzzle_settings_to_current_date` deferred to avoid accidental caller breakage in Sprint 02.
- Live remote Supabase runtime verification (beyond migration SQL assertions) was not executed in this test pass.
