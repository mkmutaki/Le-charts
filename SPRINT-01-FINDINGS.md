# Sprint 01 Findings (Backend Characterization, Testing, Refactoring)

## Characterized and Tested

- Added a full Vitest setup (`vitest.config.ts`, `src/test/setup.ts`, MSW server) with mocked Supabase env vars.
- Added characterization tests for:
  - `scheduledAlbumService` query wrappers and transformations:
    - `getAlbumForDate` result and null behavior
    - `getScheduledTrackVotes` mapped counts, empty set behavior, error behavior
    - `scheduleAlbum` happy path and date-conflict path
    - album/track conversion helpers
  - `spotifyService` integration behavior using `msw`:
    - album normalization shape
    - missing preview URL handling
    - invalid/missing artwork URL handling without throw
    - 5xx typed error surfacing
    - network failure typed error surfacing
  - `useAuthStore.checkAdminStatus`:
    - admin/non-admin/null user/error paths
  - `useVotingStore` scheduled voting behavior:
    - one vote per device/date
    - duplicate vote rejection
    - conflicting second-track rejection
    - policy/constraint-like insert rejection handling
    - admin-only scheduled vote reset behavior
  - `SupabaseListener` auth/session handling:
    - anonymous `getSession` flow
    - authenticated `getSession` + admin check flow
  - SQL migration assertions for mandatory Sprint 01 DB fixes.

## Refactored and Why

- Added `src/lib/services/adminService.ts` to centralize admin-related RPCs:
  - `getAdminStatus`
  - `isAdminUser`
  - `resetAllVotes`
- Refactored stores to remove repeated admin-check RPC patterns:
  - `useAuthStore` now uses `getAdminStatus`
  - `useScheduleStore` now uses `isAdminUser`
  - `useVotingStore` now uses `isAdminUser`
- Added migration `20260226000000_sprint01_backend_lint_fixes.sql` to resolve all confirmed DB advisor items:
  - Hardened mutable `search_path` via `ALTER FUNCTION ... SET search_path = public` for all listed function names/overloads present in `public`
  - Rewrote affected RLS policies to use `(SELECT auth.uid())` initplan style
  - Split overlapping admin `FOR ALL` policies on `scheduled_albums` and `scheduled_album_tracks` into explicit `INSERT`/`UPDATE`/`DELETE` policies
  - Added missing FK index on `scheduled_albums.created_by`
  - Ensured index exists for `song_votes.scheduled_track_id`

## Fragilities and Technical Debt Noted

- Backend behavior still relies on client-side logging and broad catch blocks in several stores/services, which can hide root causes.
- Current test suite is intentionally backend-focused for Sprint 01; total project coverage is low because UI-heavy modules are out of scope here.
- RLS behavior is validated by SQL policy assertions/mocked behavior in this sprint, not by live-database execution tests.
- Legacy migration history includes older puzzle-related function paths; those remain in history but are now hardened/handled safely.

## Deferred Decisions

- **Live Supabase integration policy/function verification** (executing SQL assertions against the remote project) was deferred to follow-up CI/infra work to keep Sprint 01 tests deterministic and local.
- **Weekend aggregation logic** was intentionally not implemented; schema/policy/query refactors were kept additive and scoped so weekend bracket aggregation can be layered later without undoing Sprint 01 changes.
