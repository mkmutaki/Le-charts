# Sprint 04 Findings (Weekend Aggregation)

## Implementation Summary

Sprint 04 was implemented across database, backend, and frontend:

1. Added new migration for:
- `weekend_bracket_tracks`
- `sunday_finalists`
- `weekly_champions`
- indexes + RLS public read policies

2. Added new Supabase Edge Function:
- `supabase/functions/resolve-weekend-bracket/index.ts`
- supports Saturday/Sunday/Monday phases + weekday no-op
- idempotent replace behavior for each phase write set
- supports `forceDate` payload override (`YYYY-MM-DD`) for testing

3. Added frontend weekend state and UI:
- `src/lib/stores/useWeekendStore.ts`
- `src/pages/Index.tsx` weekend mode switching (`weekday | saturday | sunday`)
- `src/components/Navbar.tsx` weekly champion pills
- `src/components/ScheduledSongCard.tsx` weekday source label for Saturday bracket tracks
- `src/components/EmptyState.tsx` weekend empty state

4. Added tests:
- `supabase/functions/resolve-weekend-bracket/index.test.ts`
- `src/lib/stores/useWeekendStore.test.ts`
- `src/components/Navbar.test.tsx`

## Edge Case Handling Decisions

| Scenario | Handling |
|---|---|
| No albums/votes Mon–Fri | Saturday rows are empty per day; UI shows weekend empty state |
| Only one weekday with votes | Saturday includes only that weekday’s winners |
| Only one track with votes for a weekday | Only that one track is written (`day_rank = 1`) |
| Tie for 2nd on weekday | Tie group resolved by stream count API when available |
| Stream count API failure | Fallback to lower `track_number` |
| Same `track_number` tie | Fallback to alphabetical `spotify_track_id` |
| Saturday produces 0 voted tracks | Sunday finalists set becomes empty; UI handles empty state |
| Saturday produces fewer than 5 | Sunday includes available tracks only |
| Sunday produces 0 voted tracks | Monday champion write set is empty |
| Sunday produces fewer than 3 | Monday writes available tracks only |
| Duplicate `spotify_track_id` in candidate set | Logged + duplicate candidate skipped |
| Repeated resolver execution | Writes are replace/upsert idempotent by week/day rank keys |

## Tiebreaker Integration Notes

- Tiebreaker runs server-side only in `resolve-weekend-bracket`.
- Secret key expected in function env: `RAPIDAPI_KEY`.
- Endpoint is configurable via optional `RAPIDAPI_STREAM_COUNT_ENDPOINT`.
- Current default endpoint: `https://spotify-stream-count.p.rapidapi.com/v1/spotify/tracks/{trackId}/streams/current`.
- If endpoint or payload parsing fails, resolver falls back safely to deterministic album-order tie rules.

## Manual Supabase Steps

### 1. Set secrets

In Supabase project secrets, set:
- `RAPIDAPI_KEY` (required for stream-count tie resolution)
- `RAPIDAPI_STREAM_COUNT_ENDPOINT` (optional; only if your RapidAPI plan uses a non-default path)

Status: Completed via Supabase CLI for project `yqrxkqlpppoowcilsvxg`.

### 2. Deploy function

Deploy edge function:
- `resolve-weekend-bracket`

Status: Completed via Supabase CLI deploy.

### 3. Cron job configuration

Create cron job in Supabase Studio:
- Name: `resolve-weekend-bracket`
- Schedule: `0 * * * *`
- Command: HTTP POST to the function URL

Status: Completed (confirmed in Studio).

## Vote History Compatibility Confirmation

Weekend votes continue to use `song_votes` with:
- `scheduled_track_id`
- `scheduled_date`
- `device_id`
- `ip_address`/`fingerprint_hash` where present

No new vote table was introduced, so future user vote history remains compatible with weekend voting.

## Fragilities / Follow-up Work

1. RapidAPI response schemas can vary by provider plan; endpoint override is included, but production validation is still required after key provisioning.
2. `tiebreak_used` marks tracks selected via successful stream-count ordering; fallback decisions are deterministic but not marked as stream-based tiebreak usage.
3. Cron setup is manual and not enforced in migrations; operational drift should be monitored.
4. Existing project lint baseline still includes pre-existing errors unrelated to Sprint 04 implementation.

## Verification Run

Executed successfully:
- `npm run build`
- `npm test -- --run src/**/*.test.ts supabase/migrations/*.test.ts`
- `deno test supabase/functions/resolve-weekend-bracket/index.test.ts`
- `deno test --allow-env supabase/functions/submit-vote/index.test.ts`
- Remote function smoke check: POST `resolve-weekend-bracket` with `{ \"forceDate\": \"2026-03-10\" }` returned `{ \"phase\": \"noop\", \"written\": 0 }`
- Remote phase checks with safe future dates:
  - `2026-12-08` -> `noop`
  - `2026-12-12` -> `saturday` (`written: 0`)
  - `2026-12-13` -> `sunday` (`written: 0`)
  - `2026-12-14` -> `monday` (`written: 0`)

Notes:
- `npm test -- --run` still attempts to run Deno function tests through Vitest and fails on `npm:` imports (pre-existing tooling mismatch).
