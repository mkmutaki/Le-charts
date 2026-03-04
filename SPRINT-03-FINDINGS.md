# Sprint 03 Findings (Voting UI & User Flows Characterization, Testing, Refactoring)

## Architecture Flow Audit

### 1. Device ID lifecycle

- Prior state: device ID logic lived inline in `useVotingStore` using `localStorage` key `device_id` with no UUID validation.
- Refactor: extracted device ID logic to [`src/lib/deviceId.ts`](/Users/mkmutaki/Desktop/Web Dev projects/Le-Charts/src/lib/deviceId.ts).
- Current behavior:
1. Read namespaced key `lecharts:deviceId`.
2. Fallback-read legacy `device_id`.
3. Validate UUID v4 format.
4. Migrate valid legacy value to namespaced key.
5. Generate new UUID (`crypto.randomUUID`, fallback to `uuid.v4`) when missing/invalid.
- Storage failure handling: guarded via `try/catch`; generation still succeeds if `localStorage` is unavailable.

### 2. Vote submission flow

- Trigger: heart button click in [`src/components/ScheduledSongCard.tsx`](/Users/mkmutaki/Desktop/Web Dev projects/Le-Charts/src/components/ScheduledSongCard.tsx).
- Store action: `useVotingStore.upvoteScheduledTrack(trackId, scheduledDate?)`.
- Duplicate prevention path:
1. Local store guard (`currentVoteDate` + `votedScheduledTrackId`).
2. DB pre-check query on `song_votes` by `device_id + scheduled_date`.
3. Insert only if no existing row.
- Payload inserted: `{ device_id, scheduled_track_id, scheduled_date }`.
- UI update behavior: not truly optimistic in store; card increments local count only after successful insert (`success === true`).
- Failure behavior: toast error and no vote-count increment.

### 3. Vote state resolution flow

- Entry points:
  - page initialization (Index/SupabaseListener)
  - per-card mount/update (`ScheduledSongCard`)
- Resolution source of truth: query `song_votes` filtered by `device_id + scheduled_date`.
- Local caching: Zustand keeps `votedScheduledTrackId` and `currentVoteDate` to avoid redundant queries.
- Network failure behavior: store returns `null` and logs error; UI remains usable (not hard-locked).

### 4. Date resolution and midnight transition flow

- Date utility: `getLocalDateString()` in [`src/lib/dateUtils.ts`](/Users/mkmutaki/Desktop/Web Dev projects/Le-Charts/src/lib/dateUtils.ts) uses local `Date` components (`getFullYear/getMonth/getDate`) and zero-padding.
- Midnight handling: `useDateCheck` polls every minute and triggers `onDateChange`.
- Index behavior on date change:
1. set transition/loading state
2. force fetch songs for new local date
3. re-check voted track for new date
4. clear transition state

### 5. Vote count display flow

- Source: `get_scheduled_track_votes(p_scheduled_date)` via `getScheduledTrackVotes()`.
- Merge: `useSongStore.fetchScheduledSongs()` maps track rows + vote map by track ID.
- Zero votes: default `voteCounts.get(track.id) || 0`.
- Refresh strategy:
  - interval poll in Index every 30s
  - manual refresh button
  - no Supabase realtime subscription currently for vote counts
- Error handling: failures degrade to empty vote map / zero counts without crash.

## Required Verification Decisions

### 1. Duplicate vote prevention mechanism

- Confirmed: frontend-enforced only (local guard + DB pre-check query).
- DB has no unique constraint for per-device/day voting.
- Risk: race condition remains possible under rapid concurrent requests (double-click/tab race).

### 2. `vote_date` generated column usage

- Confirmed: frontend voting logic scopes by `scheduled_date`; `vote_date` is not used in current frontend flow.

### 3. Device ID scope and collision risk

- Refactor applied: moved to namespaced key `lecharts:deviceId` with legacy fallback from `device_id`.
- Collision risk reduced versus generic key usage.

### 4. Vote count polling vs realtime

- Confirmed: counts are polling-based (30s interval + manual refresh), not realtime subscriptions.
- Implication for Sprint 04: bracket views may need tighter update semantics if near-live counts are required.

### 5. Optimistic update rollback

- Confirmed: no store-level optimistic insert update exists; UI count increments only after successful insert.
- Therefore rollback path is not required in current implementation.

## Additional Sprint 03 Notes

### IP address field behavior

- `song_votes.ip_address` remains in vote insert schema but is not sent by frontend and currently resolves as `NULL`.
- Per sprint note, logic remains unchanged for now.

### Admin vote deletion UI

- Gap identified: admin-only `DELETE` RLS existed but frontend lacked a per-track delete action.
- Implemented:
  - `useVotingStore.deleteScheduledTrackVotes(trackId, scheduledDate)` (admin-guarded).
  - Admin dashboard row action button: `Delete votes` per track in today's album view.
  - Action deletes all votes for selected track/date and refreshes track/vote list.

## Fragilities / Technical Debt for Sprint 04

- Duplicate-vote enforcement remains client-side without DB uniqueness guarantees.
- Vote state fetch uses a coarse request throttle window, which may delay immediate cross-context consistency.
- Vote counts remain polling-based rather than realtime subscriptions.
