import { createClient } from "npm:@supabase/supabase-js@2"

type ResolverPhase = "saturday" | "sunday" | "monday" | "noop"

type ResolveRequestPayload = {
  forceDate?: string
}

type VoteRow = {
  scheduled_track_id: string | null
}

type TrackMetadata = {
  id: string
  spotify_track_id: string
  track_number: number
}

type VoteAggregate = {
  scheduledTrackId: string
  spotifyTrackId: string
  trackNumber: number
  voteCount: number
}

type RankedTrack = VoteAggregate & {
  tiebreakUsed: boolean
}

type WeekendBracketWrite = {
  scheduledTrackId: string
  dayRank: number
  voteCount: number
  tiebreakUsed: boolean
}

type SundayFinalistWrite = {
  scheduledTrackId: string
  saturdayRank: number
  voteCount: number
}

type WeeklyChampionWrite = {
  scheduledTrackId: string
  finalRank: number
  voteCount: number
}

type Logger = {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

type ResolverDeps = {
  listVotesForDate: (date: string) => Promise<VoteRow[]>
  listTrackMetadata: (trackIds: string[]) => Promise<TrackMetadata[]>
  replaceWeekendBracketDay: (
    weekStartDate: string,
    sourceDate: string,
    tracks: WeekendBracketWrite[],
  ) => Promise<void>
  replaceSundayFinalists: (
    weekStartDate: string,
    tracks: SundayFinalistWrite[],
  ) => Promise<void>
  replaceWeeklyChampions: (
    weekStartDate: string,
    tracks: WeeklyChampionWrite[],
  ) => Promise<void>
  fetchStreamCounts: (trackIds: string[]) => Promise<Map<string, number> | null>
}

type SaturdayDaySummary = {
  sourceDate: string
  written: number
  skipped: boolean
}

type ResolverRunResult = {
  phase: ResolverPhase
  weekStartDate: string | null
  written: number
  saturday?: {
    daySummaries: SaturdayDaySummary[]
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const DEFAULT_RAPIDAPI_STREAM_COUNT_ENDPOINT =
  "https://spotify-stream-count.p.rapidapi.com/v1/spotify/tracks/{trackId}/streams/current"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  })
}

function parseIsoDate(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return null
  }

  const [year, month, day] = input.split("-").map((value) => Number(value))
  const utcDate = new Date(Date.UTC(year, month - 1, day))

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return null
  }

  return utcDate
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function getResolverPhase(date: Date): ResolverPhase {
  const dayOfWeek = date.getUTCDay()

  if (dayOfWeek === 6) return "saturday"
  if (dayOfWeek === 0) return "sunday"
  if (dayOfWeek === 1) return "monday"
  return "noop"
}

export function getWeekStartDate(date: Date): string {
  const dayOfWeek = date.getUTCDay()
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  return formatIsoDate(addUtcDays(date, offset))
}

function sortVoteAggregates(a: VoteAggregate, b: VoteAggregate): number {
  if (b.voteCount !== a.voteCount) {
    return b.voteCount - a.voteCount
  }

  if (a.trackNumber !== b.trackNumber) {
    return a.trackNumber - b.trackNumber
  }

  return a.spotifyTrackId.localeCompare(b.spotifyTrackId)
}

function fallbackTrackOrder(a: VoteAggregate, b: VoteAggregate): number {
  if (a.trackNumber !== b.trackNumber) {
    return a.trackNumber - b.trackNumber
  }

  return a.spotifyTrackId.localeCompare(b.spotifyTrackId)
}

function parseNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim()
    if (!normalized) return null

    const parsed = Number(normalized)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function parseStreamCountPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const queue: unknown[] = [payload]
  const visited = new Set<unknown>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== "object") {
      continue
    }

    if (visited.has(current)) {
      continue
    }
    visited.add(current)

    if (Array.isArray(current)) {
      for (const entry of current) {
        queue.push(entry)
      }
      continue
    }

    for (const [key, value] of Object.entries(current)) {
      const lowerKey = key.toLowerCase()
      const numericValue = parseNumericValue(value)

      if (
        numericValue !== null &&
        (lowerKey.includes("stream") || lowerKey.includes("play"))
      ) {
        return numericValue
      }

      if (typeof value === "object" && value !== null) {
        queue.push(value)
      }
    }
  }

  return null
}

function buildStreamCountUrl(endpoint: string, trackId: string): string {
  if (endpoint.includes("{trackId}")) {
    return endpoint.replaceAll("{trackId}", encodeURIComponent(trackId))
  }

  try {
    const url = new URL(endpoint)
    if (!url.searchParams.has("spotify_track_id")) {
      url.searchParams.set("spotify_track_id", trackId)
    }
    return url.toString()
  } catch {
    return `${endpoint}${endpoint.includes("?") ? "&" : "?"}spotify_track_id=${encodeURIComponent(trackId)}`
  }
}

export async function resolveByStreamCount(
  trackIds: string[],
  rapidApiKey: string,
  options?: {
    endpoint?: string
    fetchImpl?: typeof fetch
    logger?: Logger
  },
): Promise<string[]> {
  if (trackIds.length === 0) {
    return []
  }

  const streamCounts = await fetchStreamCountsFromApi(trackIds, rapidApiKey, options)
  if (!streamCounts) {
    return [...trackIds]
  }

  return [...trackIds].sort((a, b) => {
    const aCount = streamCounts.get(a) ?? 0
    const bCount = streamCounts.get(b) ?? 0
    return bCount - aCount
  })
}

async function fetchStreamCountsFromApi(
  trackIds: string[],
  rapidApiKey: string,
  options?: {
    endpoint?: string
    fetchImpl?: typeof fetch
    logger?: Logger
  },
): Promise<Map<string, number> | null> {
  if (trackIds.length === 0) {
    return new Map()
  }

  const endpoint = options?.endpoint ??
    Deno.env.get("RAPIDAPI_STREAM_COUNT_ENDPOINT") ??
    DEFAULT_RAPIDAPI_STREAM_COUNT_ENDPOINT
  const fetchImpl = options?.fetchImpl ?? fetch
  const logger = options?.logger ?? console

  try {
    const streamCounts = new Map<string, number>()

    for (const trackId of trackIds) {
      const targetUrl = buildStreamCountUrl(endpoint, trackId)
      const parsedTarget = new URL(targetUrl)
      const response = await fetchImpl(targetUrl, {
        method: "GET",
        headers: {
          "x-rapidapi-key": rapidApiKey,
          "x-rapidapi-host": parsedTarget.host,
        },
      })

      if (!response.ok) {
        logger.warn(
          "Stream count API request failed",
          trackId,
          response.status,
        )
        return null
      }

      const responseBody = await response.json()
      const streamCount = parseStreamCountPayload(responseBody)

      if (streamCount === null) {
        logger.warn("Stream count API returned unparseable payload", trackId)
        return null
      }

      streamCounts.set(trackId, streamCount)
    }

    return streamCounts
  } catch (error) {
    logger.warn("Stream count API failure", error)
    return null
  }
}

async function buildVoteAggregates(
  scheduledDate: string,
  deps: ResolverDeps,
  logger: Logger,
): Promise<VoteAggregate[]> {
  const votes = await deps.listVotesForDate(scheduledDate)
  const voteCountsByTrack = new Map<string, number>()

  for (const vote of votes) {
    if (!vote.scheduled_track_id) {
      continue
    }

    voteCountsByTrack.set(
      vote.scheduled_track_id,
      (voteCountsByTrack.get(vote.scheduled_track_id) ?? 0) + 1,
    )
  }

  const votedTrackIds = [...voteCountsByTrack.keys()]
  if (votedTrackIds.length === 0) {
    return []
  }

  const trackMetadataRows = await deps.listTrackMetadata(votedTrackIds)
  const metadataById = new Map(trackMetadataRows.map((row) => [row.id, row]))

  const aggregates: VoteAggregate[] = []
  for (const trackId of votedTrackIds) {
    const metadata = metadataById.get(trackId)
    if (!metadata) {
      logger.warn("Skipping vote aggregate due to missing track metadata", trackId)
      continue
    }

    aggregates.push({
      scheduledTrackId: trackId,
      spotifyTrackId: metadata.spotify_track_id,
      trackNumber: metadata.track_number,
      voteCount: voteCountsByTrack.get(trackId) ?? 0,
    })
  }

  aggregates.sort(sortVoteAggregates)

  const seenSpotifyIds = new Set<string>()
  const dedupedAggregates: VoteAggregate[] = []

  for (const aggregate of aggregates) {
    if (seenSpotifyIds.has(aggregate.spotifyTrackId)) {
      logger.warn(
        "Duplicate spotify_track_id encountered while building aggregates, skipping",
        aggregate.spotifyTrackId,
      )
      continue
    }

    seenSpotifyIds.add(aggregate.spotifyTrackId)
    dedupedAggregates.push(aggregate)
  }

  return dedupedAggregates
}

async function resolveTieGroup(
  tiedTracks: VoteAggregate[],
  deps: ResolverDeps,
  rapidApiKey: string | null,
): Promise<{ orderedTracks: VoteAggregate[]; usedStreamCount: boolean }> {
  const fallbackOrdered = [...tiedTracks].sort(fallbackTrackOrder)

  if (!rapidApiKey) {
    return {
      orderedTracks: fallbackOrdered,
      usedStreamCount: false,
    }
  }

  const trackIds = fallbackOrdered.map((track) => track.spotifyTrackId)
  const streamCountMap = await deps.fetchStreamCounts(trackIds)

  if (!streamCountMap) {
    return {
      orderedTracks: fallbackOrdered,
      usedStreamCount: false,
    }
  }

  const orderedByStreamCount = [...fallbackOrdered].sort((a, b) => {
    const aCount = streamCountMap.get(a.spotifyTrackId) ?? 0
    const bCount = streamCountMap.get(b.spotifyTrackId) ?? 0

    if (bCount !== aCount) {
      return bCount - aCount
    }

    return fallbackTrackOrder(a, b)
  })

  return {
    orderedTracks: orderedByStreamCount,
    usedStreamCount: true,
  }
}

async function selectSaturdayWinners(
  dayCandidates: VoteAggregate[],
  deps: ResolverDeps,
  rapidApiKey: string | null,
): Promise<RankedTrack[]> {
  if (dayCandidates.length === 0) {
    return []
  }

  if (dayCandidates.length === 1) {
    return [{ ...dayCandidates[0], tiebreakUsed: false }]
  }

  const secondPlaceVoteCount = dayCandidates[1].voteCount
  const higherThanSecond = dayCandidates.filter((track) =>
    track.voteCount > secondPlaceVoteCount
  )
  const secondPlaceTies = dayCandidates.filter((track) =>
    track.voteCount === secondPlaceVoteCount
  )
  const remainingSlots = Math.max(0, 2 - higherThanSecond.length)

  if (secondPlaceTies.length <= remainingSlots) {
    return dayCandidates.slice(0, 2).map((track) => ({
      ...track,
      tiebreakUsed: false,
    }))
  }

  const { orderedTracks, usedStreamCount } = await resolveTieGroup(
    secondPlaceTies,
    deps,
    rapidApiKey,
  )

  const selectedTies = orderedTracks.slice(0, remainingSlots)
  const selectedTieTrackIds = new Set(
    usedStreamCount
      ? selectedTies.map((track) => track.scheduledTrackId)
      : [],
  )

  return [...higherThanSecond, ...selectedTies].slice(0, 2).map((track) => ({
    ...track,
    tiebreakUsed: selectedTieTrackIds.has(track.scheduledTrackId),
  }))
}

function rankTopTracks(
  aggregates: VoteAggregate[],
  limit: number,
): VoteAggregate[] {
  return [...aggregates].sort(sortVoteAggregates).slice(0, limit)
}

function getWeekdayDatesForSaturday(runDate: Date): string[] {
  const weekStartDate = parseIsoDate(getWeekStartDate(runDate))
  if (!weekStartDate) {
    return []
  }

  return [0, 1, 2, 3, 4].map((offset) =>
    formatIsoDate(addUtcDays(weekStartDate, offset))
  )
}

export async function runWeekendResolver(input: {
  runDate: Date
  deps: ResolverDeps
  rapidApiKey: string | null
  logger?: Logger
}): Promise<ResolverRunResult> {
  const { runDate, deps, rapidApiKey } = input
  const logger = input.logger ?? console
  const phase = getResolverPhase(runDate)

  if (phase === "noop") {
    return {
      phase,
      weekStartDate: null,
      written: 0,
    }
  }

  if (phase === "saturday") {
    const weekStartDate = getWeekStartDate(runDate)
    const daySummaries: SaturdayDaySummary[] = []
    let totalWritten = 0

    for (const sourceDate of getWeekdayDatesForSaturday(runDate)) {
      const dayAggregates = await buildVoteAggregates(sourceDate, deps, logger)
      const winners = await selectSaturdayWinners(
        dayAggregates,
        deps,
        rapidApiKey,
      )

      const writes: WeekendBracketWrite[] = winners.map((winner, index) => ({
        scheduledTrackId: winner.scheduledTrackId,
        dayRank: index + 1,
        voteCount: winner.voteCount,
        tiebreakUsed: winner.tiebreakUsed,
      }))

      await deps.replaceWeekendBracketDay(weekStartDate, sourceDate, writes)

      daySummaries.push({
        sourceDate,
        written: writes.length,
        skipped: writes.length === 0,
      })
      totalWritten += writes.length
    }

    return {
      phase,
      weekStartDate,
      written: totalWritten,
      saturday: {
        daySummaries,
      },
    }
  }

  if (phase === "sunday") {
    const saturdayDate = formatIsoDate(addUtcDays(runDate, -1))
    const weekStartDate = getWeekStartDate(runDate)
    const saturdayAggregates = await buildVoteAggregates(saturdayDate, deps, logger)
    const finalists = rankTopTracks(saturdayAggregates, 5)
    const writes: SundayFinalistWrite[] = finalists.map((track, index) => ({
      scheduledTrackId: track.scheduledTrackId,
      saturdayRank: index + 1,
      voteCount: track.voteCount,
    }))

    await deps.replaceSundayFinalists(weekStartDate, writes)

    return {
      phase,
      weekStartDate,
      written: writes.length,
    }
  }

  const sundayDate = formatIsoDate(addUtcDays(runDate, -1))
  const weekStartDate = getWeekStartDate(runDate)
  const sundayAggregates = await buildVoteAggregates(sundayDate, deps, logger)
  const champions = rankTopTracks(sundayAggregates, 3)
  const writes: WeeklyChampionWrite[] = champions.map((track, index) => ({
    scheduledTrackId: track.scheduledTrackId,
    finalRank: index + 1,
    voteCount: track.voteCount,
  }))

  await deps.replaceWeeklyChampions(weekStartDate, writes)

  return {
    phase,
    weekStartDate,
    written: writes.length,
  }
}

function createSupabaseDeps(
  supabaseUrl: string,
  serviceRoleKey: string,
  rapidApiKey: string | null,
  logger: Logger,
): ResolverDeps {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    listVotesForDate: async (scheduledDate) => {
      const { data, error } = await supabase
        .from("song_votes")
        .select("scheduled_track_id")
        .eq("scheduled_date", scheduledDate)
        .not("scheduled_track_id", "is", null)

      if (error) {
        throw new Error(
          `Failed to list song_votes for ${scheduledDate}: ${error.message}`,
        )
      }

      return (data ?? []) as VoteRow[]
    },
    listTrackMetadata: async (trackIds) => {
      if (trackIds.length === 0) {
        return []
      }

      const { data, error } = await supabase
        .from("scheduled_album_tracks")
        .select("id, spotify_track_id, track_number")
        .in("id", trackIds)

      if (error) {
        throw new Error(`Failed to load track metadata: ${error.message}`)
      }

      return (data ?? []) as TrackMetadata[]
    },
    replaceWeekendBracketDay: async (weekStartDate, sourceDate, tracks) => {
      const { error: deleteError } = await supabase
        .from("weekend_bracket_tracks")
        .delete()
        .eq("week_start_date", weekStartDate)
        .eq("source_date", sourceDate)

      if (deleteError) {
        throw new Error(
          `Failed to clear weekend bracket rows for ${sourceDate}: ${deleteError.message}`,
        )
      }

      if (tracks.length === 0) {
        return
      }

      const upsertRows = tracks.map((track) => ({
        week_start_date: weekStartDate,
        source_date: sourceDate,
        scheduled_track_id: track.scheduledTrackId,
        day_rank: track.dayRank,
        vote_count: track.voteCount,
        tiebreak_used: track.tiebreakUsed,
      }))

      const { error: upsertError } = await supabase
        .from("weekend_bracket_tracks")
        .upsert(upsertRows, {
          onConflict: "week_start_date,source_date,day_rank",
        })

      if (upsertError) {
        throw new Error(
          `Failed to upsert weekend bracket rows for ${sourceDate}: ${upsertError.message}`,
        )
      }
    },
    replaceSundayFinalists: async (weekStartDate, tracks) => {
      const { error: deleteError } = await supabase
        .from("sunday_finalists")
        .delete()
        .eq("week_start_date", weekStartDate)

      if (deleteError) {
        throw new Error(
          `Failed to clear sunday finalists for ${weekStartDate}: ${deleteError.message}`,
        )
      }

      if (tracks.length === 0) {
        return
      }

      const upsertRows = tracks.map((track) => ({
        week_start_date: weekStartDate,
        scheduled_track_id: track.scheduledTrackId,
        saturday_rank: track.saturdayRank,
        vote_count: track.voteCount,
      }))

      const { error: upsertError } = await supabase
        .from("sunday_finalists")
        .upsert(upsertRows, {
          onConflict: "week_start_date,saturday_rank",
        })

      if (upsertError) {
        throw new Error(
          `Failed to upsert sunday finalists for ${weekStartDate}: ${upsertError.message}`,
        )
      }
    },
    replaceWeeklyChampions: async (weekStartDate, tracks) => {
      const { error: deleteError } = await supabase
        .from("weekly_champions")
        .delete()
        .eq("week_start_date", weekStartDate)

      if (deleteError) {
        throw new Error(
          `Failed to clear weekly champions for ${weekStartDate}: ${deleteError.message}`,
        )
      }

      if (tracks.length === 0) {
        return
      }

      const upsertRows = tracks.map((track) => ({
        week_start_date: weekStartDate,
        scheduled_track_id: track.scheduledTrackId,
        final_rank: track.finalRank,
        vote_count: track.voteCount,
      }))

      const { error: upsertError } = await supabase
        .from("weekly_champions")
        .upsert(upsertRows, {
          onConflict: "week_start_date,final_rank",
        })

      if (upsertError) {
        throw new Error(
          `Failed to upsert weekly champions for ${weekStartDate}: ${upsertError.message}`,
        )
      }
    },
    fetchStreamCounts: async (trackIds) => {
      if (!rapidApiKey) {
        return null
      }

      const endpoint = Deno.env.get("RAPIDAPI_STREAM_COUNT_ENDPOINT") ??
        DEFAULT_RAPIDAPI_STREAM_COUNT_ENDPOINT
      return await fetchStreamCountsFromApi(trackIds, rapidApiKey, {
        endpoint,
        logger,
      })
    },
  }
}

export async function handleResolveWeekendBracket(
  request: Request,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      {
        success: false,
        error: "Missing Supabase service credentials",
      },
      500,
    )
  }

  let payload: ResolveRequestPayload = {}

  try {
    const parsedPayload = await request.json().catch(() => ({}))
    if (parsedPayload && typeof parsedPayload === "object") {
      payload = parsedPayload as ResolveRequestPayload
    }
  } catch {
    payload = {}
  }

  const forceDate = payload.forceDate
  const runDate = forceDate ? parseIsoDate(forceDate) : new Date()

  if (!runDate) {
    return jsonResponse(
      {
        success: false,
        error: "forceDate must use YYYY-MM-DD format",
      },
      400,
    )
  }

  try {
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY") ?? null
    const deps = createSupabaseDeps(
      supabaseUrl,
      serviceRoleKey,
      rapidApiKey,
      console,
    )

    const result = await runWeekendResolver({
      runDate,
      deps,
      rapidApiKey,
      logger: console,
    })

    return jsonResponse({ success: true, ...result })
  } catch (error) {
    console.error("resolve-weekend-bracket failed", error)
    return jsonResponse(
      {
        success: false,
        error: "Failed to resolve weekend bracket",
      },
      500,
    )
  }
}

if (import.meta.main) {
  Deno.serve(handleResolveWeekendBracket)
}
