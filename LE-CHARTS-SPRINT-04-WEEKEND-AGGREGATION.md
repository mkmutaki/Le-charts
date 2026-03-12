# Le-Charts — Sprint 04: Weekend Aggregation (New Feature)

## Purpose of This Document

This document defines the full scope, methodology, and instructions for **Sprint 04** of the Le-Charts initiative. Unlike Sprints 01–03 which characterised and refactored existing code, **Sprint 04 is a net-new feature**. The methodology shifts accordingly: design and implement with tests written alongside the code, not after.

This document is the authoritative brief. Read it in full before writing a single line of code or SQL.

---

## Prerequisites — Confirm Before Starting

- [ ] Sprint 01, 02, and 03 findings files are present and all noted deferred items reviewed
- [ ] Full test suite (`vitest`) from Sprints 01–03 passes with zero failures
- [ ] `src/lib/deviceId.ts` exists as an isolated utility
- [ ] `src/lib/dateUtils.ts` exists with `getLocalDateString()` returning `YYYY-MM-DD` in local time
- [ ] The `submit-vote` Edge Function (IP + fingerprint hashing) is deployed and operational
- [ ] The `refresh-album-statuses` cron job is confirmed running in Supabase Studio
- [ ] You have read the existing `useVotingStore.ts`, `useSongStore.ts`, `useScheduleStore.ts`, and `scheduledAlbumService.ts` in full before touching any of them

---

## Feature Overview

Le-Charts currently runs a Monday–Friday daily album voting cycle. This sprint adds a weekend aggregation layer:

- **Saturday**: displays the top 2 voted tracks from each weekday of the current calendar week (Mon–Fri), giving up to 10 tracks. Users vote on these 10 tracks once per day (Saturday's date scopes the votes).
- **Sunday**: displays the top 5 voted tracks from Saturday's voting session. Users vote on these 5 tracks once (Sunday's date scopes the votes).
- **Weekly champions**: the top 3 tracks from Sunday's voting session are persisted indefinitely and displayed in the navbar throughout the following week until the next Sunday's results replace them.

All transitions are date-driven using the user's local device date, consistent with the existing Wordle-style resolution established in Sprint 03.

---

## Game Logic — Complete Specification

### Week definition
A "week" is always the **current calendar week anchored to Monday–Friday**. It is not relative to the most recent 5 days. If Saturday is `2026-03-07`, the week is `2026-03-02` (Mon) through `2026-03-06` (Fri).

Use `getLocalDateString()` from `src/lib/dateUtils.ts` as the date source. Derive Monday's date from the current Saturday by subtracting 5 days.

### Saturday — bracket construction

1. For each weekday (Mon–Fri) of the current calendar week, query the top 2 voted tracks from `song_votes` joined against `scheduled_album_tracks`, filtered by that day's `scheduled_date`.
2. "Top 2" means the 2 tracks with the highest vote count on that specific day. Vote counts come from `song_votes` rows where `scheduled_date = that_day` and `scheduled_track_id IS NOT NULL`.
3. If a day has **no scheduled album** or **no votes at all**: skip it. Contribute 0 tracks from that day.
4. If a day has **exactly 1 track with votes** (all others are zero): take that 1 track only — do not pad with zero-vote tracks.
5. If a day has **2 or more tracks with votes**: take exactly the top 2.
6. The result is between 0 and 10 tracks depending on the week. Saturday's UI must handle any count gracefully including 0 (show an appropriate empty state — do not crash).

### Tiebreaker — Spotify stream count

A tie occurs when two or more tracks are tied for the 2nd position on a given day (i.e. the 3rd-place track has the same vote count as the 2nd-place track). The 1st position can also tie with 2nd — treat this the same way.

**Tiebreaker resolution:**
- Call the Spotify stream count API (`https://rapidapi.com/MusicAnalyticsApi/api/spotify-stream-count`) for each tied track using its `spotify_track_id`.
- The track with the **higher current stream count** advances.
- This call must happen **server-side** in a Supabase Edge Function named `resolve-weekend-bracket`. The RapidAPI key must be stored as a Supabase secret (`RAPIDAPI_KEY`), never exposed to the frontend.
- If the API call fails (network error, rate limit, invalid response): fall back to **lower `track_number`** as the tiebreaker (the earlier track on the album wins). Log the failure.
- If track numbers are also equal (should not happen but guard for it): fall back to **alphabetical order of `spotify_track_id`**.

### Saturday voting deduplication

The existing `submit-vote` Edge Function deduplicates by `device_id + scheduled_date` and `ip_hash + fingerprint_hash + scheduled_date`. On Saturday, `scheduled_date` is Saturday's date. Weekday vote records have their respective weekday dates. Therefore **a user who voted on a weekday track gets a clean slate on Saturday** — no changes needed to the Edge Function. This is correct and intentional.

The same logic applies to Sunday.

### Sunday — finalist construction

1. Query all votes from `song_votes` where `scheduled_date = Saturday's date`.
2. Rank all tracks by vote count descending.
3. Take the top 5. If fewer than 5 tracks received votes on Saturday, take however many did (minimum 0). Do not pad with zero-vote tracks.
4. If fewer than 5 tracks exist (e.g. Saturday only had 4 tracks due to a sparse week): carry all of them forward. Sunday's UI must handle any count between 0 and 5 gracefully.

### Weekly champions — persistence

After Sunday voting closes (i.e. when the local date transitions from Sunday to Monday):

1. Compute the top 3 tracks from `song_votes` where `scheduled_date = Sunday's date`, ranked by vote count descending.
2. If fewer than 3 tracks received votes: persist however many did.
3. Persist results to `weekly_champions` table (schema defined below).
4. These champions are displayed in the navbar throughout the following Mon–Fri week.
5. Champions are replaced only when a new Sunday's results are computed. They are **never deleted** — all historical champion sets are retained indefinitely.

### Navbar display

- Display the current week's champions (up to 3) as pill-shaped cards with track artwork and truncated track name, matching the mockup provided.
- If no champions exist yet (first week of the app, or Sunday produced zero votes): render nothing in the navbar champion area — do not show empty pills.
- If only 1 or 2 champions exist (sparse week): display however many exist with natural spacing. Do not force 3 slots.
- Pills are non-interactive in Sprint 04 (no click handler needed). A future sprint will add navigation.

---

## Edge Cases — Full Enumeration

Handle every case below. Document your handling decision in `SPRINT-04-FINDINGS.md`.

| Scenario | Required behaviour |
|---|---|
| No albums scheduled Mon–Fri | Saturday shows 0 tracks, empty state UI |
| Only 1 day has albums and votes | Saturday shows up to 2 tracks from that day only |
| Only 1 track on a given day has any votes | Take that 1 track, not the zero-vote runners-up |
| Tie for 2nd place on a given day | Resolve via Spotify stream count API (Edge Function) |
| Stream count API fails during tiebreak | Fall back to lower `track_number`, log failure |
| Track numbers also tied | Fall back to alphabetical `spotify_track_id` |
| Saturday produces 0 voted tracks | Sunday shows 0 tracks, empty state UI |
| Saturday produces fewer than 5 voted tracks | Sunday shows however many exist |
| Sunday produces 0 voted tracks | Weekly champions: no row written for that week, navbar shows nothing |
| Sunday produces fewer than 3 voted tracks | Persist however many exist, navbar shows that many pills |
| Cron job fires before midnight in some timezone | Votes are scoped by `scheduled_date` (client local date), not server UTC time — this is safe by design |
| Admin didn't schedule one or more weekdays | Skip those days silently, aggregate from days that do have data |
| Two tracks have identical `spotify_track_id` | Should be impossible by schema — guard with a log warning and skip the duplicate |
| Weekend aggregation runs but prior week's data already exists | Idempotent: use `INSERT ... ON CONFLICT DO UPDATE` or check before inserting |

---

## Database Schema — New Tables

Create all tables via a new migration file. Never edit existing migrations.

### `weekend_bracket_tracks`

Stores the computed Saturday bracket (top 2 per weekday) for each week.

```sql
CREATE TABLE public.weekend_bracket_tracks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,           -- always the Monday of the week
  source_date     DATE NOT NULL,           -- the weekday this track was top-voted on
  scheduled_track_id UUID NOT NULL
    REFERENCES public.scheduled_album_tracks(id) ON DELETE CASCADE,
  day_rank        INTEGER NOT NULL         -- 1 or 2 (position within that day)
    CHECK (day_rank BETWEEN 1 AND 2),
  vote_count      INTEGER NOT NULL DEFAULT 0,
  tiebreak_used   BOOLEAN NOT NULL DEFAULT false,  -- true if stream count tiebreak was applied
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (week_start_date, source_date, day_rank)
);
```

### `sunday_finalists`

Stores the top 5 tracks from Saturday's voting session for each week.

```sql
CREATE TABLE public.sunday_finalists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  scheduled_track_id UUID NOT NULL
    REFERENCES public.scheduled_album_tracks(id) ON DELETE CASCADE,
  saturday_rank   INTEGER NOT NULL         -- 1–5, position in Saturday's results
    CHECK (saturday_rank BETWEEN 1 AND 10),-- upper bound 10 in case of ties
  vote_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (week_start_date, saturday_rank)
);
```

### `weekly_champions`

Stores the final top 3 from Sunday's vote. Persisted indefinitely.

```sql
CREATE TABLE public.weekly_champions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,           -- Monday of the resolved week
  scheduled_track_id UUID NOT NULL
    REFERENCES public.scheduled_album_tracks(id) ON DELETE CASCADE,
  final_rank      INTEGER NOT NULL         -- 1, 2, or 3
    CHECK (final_rank BETWEEN 1 AND 3),
  vote_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (week_start_date, final_rank)
);
```

### Indexes

```sql
CREATE INDEX idx_weekend_bracket_week ON public.weekend_bracket_tracks(week_start_date);
CREATE INDEX idx_sunday_finalists_week ON public.sunday_finalists(week_start_date);
CREATE INDEX idx_weekly_champions_week ON public.weekly_champions(week_start_date);
```

### RLS

All three tables follow the same pattern:

- SELECT: public read (`USING (true)`) — frontend needs to read champions without auth
- INSERT / UPDATE / DELETE: service role only (aggregation runs server-side via Edge Function using `SUPABASE_SERVICE_ROLE_KEY`) — no RLS policy needed for writes since the Edge Function bypasses RLS

Enable RLS on all three tables and create only the SELECT policy.

---

## Backend — Aggregation Edge Function

Create a new Edge Function: `resolve-weekend-bracket`.

This function is called by the cron job (see below). It must be **idempotent** — safe to call multiple times for the same week without duplicating data.

### Responsibilities

**When called on Saturday (local date is Saturday):**
1. Derive `week_start_date` (Monday of current week).
2. For each weekday Mon–Fri:
   a. Query `song_votes` joined to `scheduled_album_tracks` for that day's `scheduled_date`.
   b. Compute per-track vote counts.
   c. Select top 2 by vote count. If tie for 2nd, call the Spotify stream count API for tied tracks (server-side, using `RAPIDAPI_KEY` secret). If API fails, use `track_number` fallback.
   d. Upsert results into `weekend_bracket_tracks`.
3. Return a summary of how many tracks were written per day.

**When called on Sunday (local date is Sunday):**
1. Derive Saturday's date (yesterday).
2. Query `song_votes` where `scheduled_date = Saturday's date`.
3. Compute per-track vote counts, take top 5.
4. Upsert into `sunday_finalists`.
5. Return summary.

**When called on Monday (local date is Monday, i.e. first run after Sunday ends):**
1. Derive Sunday's date (yesterday).
2. Query `song_votes` where `scheduled_date = Sunday's date`.
3. Compute per-track vote counts, take top 3.
4. Upsert into `weekly_champions`.
5. Return summary.

**On all other days (Tue–Fri):** return early with a no-op response. Do not error.

### Spotify stream count tiebreaker (within the Edge Function)

```typescript
async function resolveByStreamCount(
  trackIds: string[],   // spotify_track_id values of tied tracks
  rapidApiKey: string
): Promise<string[]>    // returns trackIds sorted descending by stream count
```

- Call `https://spotify-stream-count.p.rapidapi.com/` (verify exact endpoint path against RapidAPI docs before implementing) for each tied `spotify_track_id`.
- Parse the stream count from the response.
- Sort descending. Return sorted array.
- If any call fails or returns unparseable data: log the error, return the original order (triggering `track_number` fallback in the caller).
- Do not throw — always return a result.

### Function interface

The function accepts an optional `{ forceDate?: string }` parameter for testing purposes, allowing a date override without changing system time. In production this is always omitted and the function uses the current UTC date to determine which phase (Sat/Sun/Mon) to run.

Note: The function uses server UTC date to decide which phase to run. Saturday in UTC may lag some timezones. This is acceptable — the aggregation does not need to be instantaneous at local midnight, only eventually consistent within the hour. Vote data is always scoped by client-provided `scheduled_date` so no votes are lost even if aggregation runs slightly late.

---

## Cron Job

Extend the existing `refresh-album-statuses` cron schedule or create a new job. **Prefer a separate job** to keep concerns isolated.

Create a new cron job named `resolve-weekend-bracket` in Supabase Studio:
- **Schedule**: `0 * * * *` (every hour, on the hour)
- **Command**: HTTP POST to the `resolve-weekend-bracket` Edge Function URL
- Hourly is sufficient — the function is idempotent and returns early on weekdays

Document the cron job configuration in `SPRINT-04-FINDINGS.md` since it is a manual step in Supabase Studio, not enforced in code.

---

## Frontend — New State and UI

### New store or store extension

Assess whether weekend state belongs in `useSongStore`, `useVotingStore`, or a new `useWeekendStore`. Given the separation of concerns established in Sprints 02–03, **a new `useWeekendStore.ts`** is strongly preferred. It should not be merged into existing stores.

`useWeekendStore` manages:
- `weekendMode`: `'weekday' | 'saturday' | 'sunday'` — derived from `getLocalDateString()`
- `bracketTracks`: the Saturday track list (from `weekend_bracket_tracks` for the current week)
- `sundayFinalists`: the Sunday track list (from `sunday_finalists` for the current week)
- `weeklyChampions`: the current week's champions (from `weekly_champions`, most recent `week_start_date`)
- Loading and error states for each

### Date-mode resolution

On every page load and on midnight transition (reuse the existing `useDateCheck` hook from Sprint 03):

```
getLocalDateString() → determine day of week
  Monday–Friday  → weekday mode (existing flow, no change)
  Saturday       → saturday mode
  Sunday         → sunday mode
```

This must use `getLocalDateString()` from `src/lib/dateUtils.ts` — never `new Date().getDay()` directly, as that uses local time correctly but bypasses the established utility.

### Saturday UI

- Replace the weekday album voting UI with the Saturday bracket view.
- Display all available bracket tracks (0–10) in the same `ScheduledSongCard` component used on weekdays. Do not create a new card component — extend or reuse the existing one.
- Each card shows track name, artist, album artwork, vote count, and vote button.
- Vote submission uses the **existing `submit-vote` Edge Function** unchanged. `scheduledDate` passed is Saturday's date. `trackId` is the `scheduled_track_id` from `weekend_bracket_tracks`.
- If 0 tracks are available: show a clear empty state ("No tracks available this weekend" or similar). Do not show a broken or blank page.
- Show which weekday each track came from (e.g. a subtle label "Monday" on the card). Source is `source_date` from `weekend_bracket_tracks`.

### Sunday UI

- Display Sunday finalists (0–5 tracks) in the same card component.
- Same voting mechanics as Saturday.
- If 0 tracks: empty state.

### Navbar — weekly champions

- Query `weekly_champions` ordered by `week_start_date DESC`, take the most recent set.
- Determine "current week's champions": the row set where `week_start_date` is the Monday of the current calendar week.
- If current week has no champions yet (it is Mon–Sat of a week that hasn't resolved): show the **previous week's champions** instead. This ensures the navbar is never empty after the first week completes.
- Render up to 3 pill components. If fewer exist, render however many do with natural flex spacing (no empty placeholder slots).
- Each pill: circular album artwork thumbnail + truncated track name. Match the mockup provided.
- Pills are display-only in this sprint (no onClick). Add a `// TODO Sprint 05: link to track detail` comment.

### Midnight transition — weekend modes

Reuse `useDateCheck` from Sprint 03. The existing hook polls every minute and fires `onDateChange`. Extend the handler in `Index.tsx` (or wherever it currently lives) to:

1. Recompute `weekendMode` from the new local date.
2. If transitioning into Saturday: fetch bracket tracks.
3. If transitioning into Sunday: fetch Sunday finalists.
4. If transitioning into Monday: fetch new weekly champions for the navbar, reset weekend state, resume weekday flow.

Do not re-implement the polling — extend the existing handler.

---

## Vote History Compatibility

Sprint 03 findings note that a future account feature will show users their voted song history. Weekend votes must be compatible with this:

- Weekend votes are stored in `song_votes` exactly like weekday votes: `{ device_id, scheduled_track_id, scheduled_date, ip_address, fingerprint_hash }`.
- `scheduled_date` for Saturday votes is Saturday's date; for Sunday votes, Sunday's date.
- No schema changes to `song_votes` are required.
- The `scheduled_track_id` foreign key references `scheduled_album_tracks` — weekend bracket tracks are also `scheduled_album_tracks` rows, so the reference is valid and history queries will work naturally.

---

## Testing Requirements

This sprint introduces new code, so tests are written **alongside implementation**, not after. Every function, store action, and utility must have tests before it is considered done.

### Edge Function — `resolve-weekend-bracket`

- Saturday phase: given mock vote data for a full Mon–Fri week, correct bracket of up to 10 tracks is computed
- Saturday phase: days with no votes are skipped, result has fewer than 10 tracks
- Saturday phase: only 1 track with votes on a given day — only that 1 track is included, not zero-vote tracks
- Saturday phase: tie for 2nd — stream count API is called, higher stream count wins
- Saturday phase: stream count API fails — falls back to lower `track_number`
- Saturday phase: `track_number` also tied — falls back to alphabetical `spotify_track_id`
- Saturday phase: idempotent — calling twice for same week does not duplicate rows
- Sunday phase: top 5 from Saturday votes computed correctly
- Sunday phase: fewer than 5 Saturday tracks — all are included
- Sunday phase: 0 Saturday votes — empty result, no crash, no write
- Monday phase: top 3 from Sunday votes persisted to `weekly_champions`
- Monday phase: fewer than 3 Sunday tracks — all persisted
- Weekday phase (Tue–Fri): function returns early, no writes

### `useWeekendStore`

- `weekendMode` resolves correctly for Saturday, Sunday, and weekday dates (use `vi.setSystemTime`)
- `bracketTracks` is populated from `weekend_bracket_tracks` on Saturday
- `sundayFinalists` is populated from `sunday_finalists` on Sunday
- `weeklyChampions` returns most recent set
- `weeklyChampions` falls back to previous week when current week has no champions yet
- Empty states: 0 tracks returns empty array, not null/undefined
- Loading and error states behave correctly

### Navbar champion pills

- Renders 3 pills when 3 champions exist
- Renders 1 pill when only 1 champion exists (sparse week)
- Renders nothing when no champions exist at all
- Renders previous week's champions when current week has none yet
- Artwork and track name display correctly
- Truncation applies when track name is long

### Tiebreaker utility

- Given two tracks with different stream counts: higher wins
- Given two tracks where API fails: lower `track_number` wins
- Given identical `track_number`: alphabetical `spotify_track_id` wins
- Stream count API error does not throw — returns graceful fallback

### Integration

- Full suite from Sprints 01–03 remains green after Sprint 04 changes
- No existing store actions are broken by the addition of `useWeekendStore`

---

## Deliverables

By the end of Sprint 04, the following must exist:

1. **Migration file** creating `weekend_bracket_tracks`, `sunday_finalists`, `weekly_champions` with indexes and RLS
2. **`resolve-weekend-bracket` Edge Function** deployed and tested with `forceDate` override support
3. **`RAPIDAPI_KEY` secret** set in Supabase project secrets (manual step — document in findings)
4. **Cron job** `resolve-weekend-bracket` configured in Supabase Studio (manual step — document in findings)
5. **`useWeekendStore.ts`** with full test coverage
6. **Saturday and Sunday UI** rendering in `Index.tsx` based on `weekendMode`
7. **Navbar champion pills** rendering from `weekly_champions`
8. **Full test suite green** — Sprints 01 + 02 + 03 + 04 all pass together
9. **`SPRINT-04-FINDINGS.md`** documenting:
   - All edge case handling decisions
   - Tiebreaker API integration notes and any deviations from spec
   - Manual steps completed (cron job, secret)
   - Any fragilities or follow-up work for future sprints
   - Confirmation of vote history compatibility

---

## Rules

- Never edit existing migration files.
- Never expose `RAPIDAPI_KEY` or `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
- All TypeScript remains strict — no loosening of `tsconfig`.
- Do not modify the `submit-vote` Edge Function.
- Do not modify `src/lib/deviceId.ts` or `src/lib/dateUtils.ts` — only import them.
- Do not merge weekend state into existing stores — use `useWeekendStore`.
- The `resolve-weekend-bracket` function must be idempotent. Assume it may be called multiple times.
- If you encounter an edge case not listed in this document, stop and document it in `SPRINT-04-FINDINGS.md` before deciding how to handle it.
- Weekend vote records must be fully compatible with the future user vote history feature — do not store weekend votes in any table other than `song_votes`.
