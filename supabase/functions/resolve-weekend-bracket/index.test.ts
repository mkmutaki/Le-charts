import {
  getResolverPhase,
  getWeekStartDate,
  resolveByStreamCount,
  runWeekendResolver,
} from "./index.ts"

type TestTrack = {
  id: string
  spotifyId: string
  trackNumber: number
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      message ?? `Expected ${String(expected)} but received ${String(actual)}`,
    )
  }
}

function assertArrayEquals<T>(actual: T[], expected: T[], message?: string): void {
  if (actual.length !== expected.length) {
    throw new Error(
      message ?? `Expected array length ${expected.length}, got ${actual.length}`,
    )
  }

  for (let index = 0; index < actual.length; index += 1) {
    if (!Object.is(actual[index], expected[index])) {
      throw new Error(
        message ??
          `Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`,
      )
    }
  }
}

function dateFromIso(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`)
}

function addVotes(
  votesByDate: Map<string, string[]>,
  date: string,
  trackId: string,
  count: number,
): void {
  const existing = votesByDate.get(date) ?? []
  for (let index = 0; index < count; index += 1) {
    existing.push(trackId)
  }
  votesByDate.set(date, existing)
}

function createTrack(
  id: string,
  spotifyId: string,
  trackNumber: number,
): TestTrack {
  return { id, spotifyId, trackNumber }
}

function createMockResolverDeps(options?: {
  votesByDate?: Map<string, string[]>
  tracks?: TestTrack[]
  streamCountMapBySpotifyId?: Map<string, number> | null
}) {
  const votesByDate = options?.votesByDate ?? new Map<string, string[]>()
  const tracks = options?.tracks ?? []
  const trackMap = new Map(
    tracks.map((track) => [track.id, {
      id: track.id,
      spotify_track_id: track.spotifyId,
      track_number: track.trackNumber,
    }]),
  )

  const weekendRowsByKey = new Map<string, Array<{
    scheduledTrackId: string
    dayRank: number
    voteCount: number
    tiebreakUsed: boolean
  }>>()
  const sundayRowsByWeek = new Map<string, Array<{
    scheduledTrackId: string
    saturdayRank: number
    voteCount: number
  }>>()
  const championsByWeek = new Map<string, Array<{
    scheduledTrackId: string
    finalRank: number
    voteCount: number
  }>>()

  const deps = {
    listVotesForDate: async (date: string) =>
      (votesByDate.get(date) ?? []).map((scheduledTrackId) => ({
        scheduled_track_id: scheduledTrackId,
      })),
    listTrackMetadata: async (trackIds: string[]) =>
      trackIds
        .map((id) => trackMap.get(id))
        .filter((row): row is { id: string; spotify_track_id: string; track_number: number } =>
          Boolean(row)
        ),
    replaceWeekendBracketDay: async (
      weekStartDate: string,
      sourceDate: string,
      tracksToWrite: Array<{
        scheduledTrackId: string
        dayRank: number
        voteCount: number
        tiebreakUsed: boolean
      }>,
    ) => {
      weekendRowsByKey.set(`${weekStartDate}|${sourceDate}`, tracksToWrite)
    },
    replaceSundayFinalists: async (
      weekStartDate: string,
      tracksToWrite: Array<{
        scheduledTrackId: string
        saturdayRank: number
        voteCount: number
      }>,
    ) => {
      sundayRowsByWeek.set(weekStartDate, tracksToWrite)
    },
    replaceWeeklyChampions: async (
      weekStartDate: string,
      tracksToWrite: Array<{
        scheduledTrackId: string
        finalRank: number
        voteCount: number
      }>,
    ) => {
      championsByWeek.set(weekStartDate, tracksToWrite)
    },
    fetchStreamCounts: async (spotifyTrackIds: string[]) => {
      if (!options || options.streamCountMapBySpotifyId === null) {
        return null
      }

      const map = new Map<string, number>()
      for (const spotifyTrackId of spotifyTrackIds) {
        const count = options.streamCountMapBySpotifyId?.get(spotifyTrackId)
        if (count === undefined) {
          return null
        }
        map.set(spotifyTrackId, count)
      }
      return map
    },
  }

  return {
    deps,
    weekendRowsByKey,
    sundayRowsByWeek,
    championsByWeek,
  }
}

Deno.test("phase and week-start helpers resolve expected UTC values", () => {
  assertEquals(getResolverPhase(dateFromIso("2026-03-07")), "saturday")
  assertEquals(getResolverPhase(dateFromIso("2026-03-08")), "sunday")
  assertEquals(getResolverPhase(dateFromIso("2026-03-09")), "monday")
  assertEquals(getResolverPhase(dateFromIso("2026-03-10")), "noop")

  assertEquals(getWeekStartDate(dateFromIso("2026-03-07")), "2026-03-02")
  assertEquals(getWeekStartDate(dateFromIso("2026-03-08")), "2026-03-02")
  assertEquals(getWeekStartDate(dateFromIso("2026-03-09")), "2026-03-09")
})

Deno.test("resolveByStreamCount orders by highest stream count and falls back gracefully", async () => {
  const successOrder = await resolveByStreamCount(
    ["sp-a", "sp-b"],
    "rapid-key",
    {
      endpoint: "https://spotify-stream-count.p.rapidapi.com/",
      fetchImpl: async (input) => {
        const url = input instanceof Request ? new URL(input.url) : new URL(String(input))
        const spotifyTrackId = url.searchParams.get("spotify_track_id")

        return new Response(
          JSON.stringify({ data: { stream_count: spotifyTrackId === "sp-a" ? 10 : 20 } }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        )
      },
      logger: console,
    },
  )

  assertArrayEquals(successOrder, ["sp-b", "sp-a"])

  const fallbackOrder = await resolveByStreamCount(
    ["sp-a", "sp-b"],
    "rapid-key",
    {
      endpoint: "https://spotify-stream-count.p.rapidapi.com/",
      fetchImpl: async () => new Response("{}", { status: 429 }),
      logger: console,
    },
  )

  assertArrayEquals(fallbackOrder, ["sp-a", "sp-b"])
})

Deno.test("saturday phase builds up to 10 tracks, skipping empty weekdays", async () => {
  const votesByDate = new Map<string, string[]>()
  const tracks: TestTrack[] = []

  for (const [dayOffset, day] of [
    [0, "2026-03-02"],
    [1, "2026-03-03"],
    [2, "2026-03-04"],
  ] as const) {
    const top = createTrack(`track-${dayOffset}-a`, `sp-${dayOffset}-a`, 1)
    const runnerUp = createTrack(`track-${dayOffset}-b`, `sp-${dayOffset}-b`, 2)
    const third = createTrack(`track-${dayOffset}-c`, `sp-${dayOffset}-c`, 3)
    tracks.push(top, runnerUp, third)

    addVotes(votesByDate, day, top.id, 10)
    addVotes(votesByDate, day, runnerUp.id, 5)
    addVotes(votesByDate, day, third.id, 1)
  }

  const { deps, weekendRowsByKey } = createMockResolverDeps({ votesByDate, tracks })

  const result = await runWeekendResolver({
    runDate: dateFromIso("2026-03-07"),
    deps,
    rapidApiKey: null,
    logger: console,
  })

  assertEquals(result.phase, "saturday")
  assertEquals(result.weekStartDate, "2026-03-02")
  assertEquals(result.written, 6)

  assertEquals(weekendRowsByKey.get("2026-03-02|2026-03-02")?.length ?? 0, 2)
  assertEquals(weekendRowsByKey.get("2026-03-02|2026-03-03")?.length ?? 0, 2)
  assertEquals(weekendRowsByKey.get("2026-03-02|2026-03-04")?.length ?? 0, 2)
  assertEquals(weekendRowsByKey.get("2026-03-02|2026-03-05")?.length ?? 0, 0)
  assertEquals(weekendRowsByKey.get("2026-03-02|2026-03-06")?.length ?? 0, 0)
})

Deno.test("saturday phase keeps single-track day without zero-vote padding", async () => {
  const onlyTrack = createTrack("track-mon-only", "sp-mon-only", 4)
  const votesByDate = new Map<string, string[]>()
  addVotes(votesByDate, "2026-03-02", onlyTrack.id, 7)

  const { deps, weekendRowsByKey } = createMockResolverDeps({
    votesByDate,
    tracks: [onlyTrack],
  })

  await runWeekendResolver({
    runDate: dateFromIso("2026-03-07"),
    deps,
    rapidApiKey: null,
    logger: console,
  })

  const mondayRows = weekendRowsByKey.get("2026-03-02|2026-03-02") ?? []
  assertEquals(mondayRows.length, 1)
  assertEquals(mondayRows[0]?.scheduledTrackId, onlyTrack.id)
  assertEquals(mondayRows[0]?.dayRank, 1)
})

Deno.test("saturday tie for second uses stream count when available", async () => {
  const first = createTrack("track-first", "sp-first", 1)
  const tiedOne = createTrack("track-tie-1", "sp-tie-1", 2)
  const tiedTwo = createTrack("track-tie-2", "sp-tie-2", 3)
  const votesByDate = new Map<string, string[]>()

  addVotes(votesByDate, "2026-03-02", first.id, 9)
  addVotes(votesByDate, "2026-03-02", tiedOne.id, 5)
  addVotes(votesByDate, "2026-03-02", tiedTwo.id, 5)

  const { deps, weekendRowsByKey } = createMockResolverDeps({
    votesByDate,
    tracks: [first, tiedOne, tiedTwo],
    streamCountMapBySpotifyId: new Map([
      ["sp-first", 100],
      ["sp-tie-1", 200],
      ["sp-tie-2", 300],
    ]),
  })

  await runWeekendResolver({
    runDate: dateFromIso("2026-03-07"),
    deps,
    rapidApiKey: "rapid-key",
    logger: console,
  })

  const mondayRows = weekendRowsByKey.get("2026-03-02|2026-03-02") ?? []
  assertEquals(mondayRows.length, 2)
  assertEquals(mondayRows[0]?.scheduledTrackId, first.id)
  assertEquals(mondayRows[1]?.scheduledTrackId, tiedTwo.id)
  assertEquals(mondayRows[1]?.tiebreakUsed, true)
})

Deno.test("saturday tie falls back to lower track_number then spotify id when API fails", async () => {
  const first = createTrack("track-first", "sp-first", 1)
  const tiedHigherTrackNumber = createTrack("track-tie-a", "sp-b", 5)
  const tiedLowerTrackNumber = createTrack("track-tie-b", "sp-c", 2)
  const sameTrackNumberAlphaWinner = createTrack("track-tie-c", "sp-a", 2)
  const votesByDate = new Map<string, string[]>()

  addVotes(votesByDate, "2026-03-02", first.id, 8)
  addVotes(votesByDate, "2026-03-02", tiedHigherTrackNumber.id, 5)
  addVotes(votesByDate, "2026-03-02", tiedLowerTrackNumber.id, 5)
  addVotes(votesByDate, "2026-03-02", sameTrackNumberAlphaWinner.id, 5)

  const { deps, weekendRowsByKey } = createMockResolverDeps({
    votesByDate,
    tracks: [first, tiedHigherTrackNumber, tiedLowerTrackNumber, sameTrackNumberAlphaWinner],
    streamCountMapBySpotifyId: null,
  })

  await runWeekendResolver({
    runDate: dateFromIso("2026-03-07"),
    deps,
    rapidApiKey: "rapid-key",
    logger: console,
  })

  const mondayRows = weekendRowsByKey.get("2026-03-02|2026-03-02") ?? []
  assertEquals(mondayRows.length, 2)
  assertEquals(mondayRows[0]?.scheduledTrackId, first.id)
  assertEquals(mondayRows[1]?.scheduledTrackId, sameTrackNumberAlphaWinner.id)
  assertEquals(mondayRows[1]?.tiebreakUsed, false)
})

Deno.test("saturday phase is idempotent when called repeatedly", async () => {
  const trackA = createTrack("track-a", "sp-a", 1)
  const trackB = createTrack("track-b", "sp-b", 2)
  const votesByDate = new Map<string, string[]>()

  addVotes(votesByDate, "2026-03-02", trackA.id, 5)
  addVotes(votesByDate, "2026-03-02", trackB.id, 3)

  const { deps, weekendRowsByKey } = createMockResolverDeps({
    votesByDate,
    tracks: [trackA, trackB],
  })

  await runWeekendResolver({
    runDate: dateFromIso("2026-03-07"),
    deps,
    rapidApiKey: null,
    logger: console,
  })

  await runWeekendResolver({
    runDate: dateFromIso("2026-03-07"),
    deps,
    rapidApiKey: null,
    logger: console,
  })

  const mondayRows = weekendRowsByKey.get("2026-03-02|2026-03-02") ?? []
  assertEquals(mondayRows.length, 2)
  assertEquals(mondayRows[0]?.scheduledTrackId, trackA.id)
  assertEquals(mondayRows[1]?.scheduledTrackId, trackB.id)
})

Deno.test("sunday phase ranks top 5 Saturday tracks and handles sparse/empty weeks", async () => {
  const tracks = Array.from({ length: 6 }).map((_, index) =>
    createTrack(`sat-track-${index + 1}`, `sat-sp-${index + 1}`, index + 1)
  )

  const votesByDate = new Map<string, string[]>()
  addVotes(votesByDate, "2026-03-07", tracks[0].id, 10)
  addVotes(votesByDate, "2026-03-07", tracks[1].id, 9)
  addVotes(votesByDate, "2026-03-07", tracks[2].id, 8)
  addVotes(votesByDate, "2026-03-07", tracks[3].id, 7)
  addVotes(votesByDate, "2026-03-07", tracks[4].id, 6)
  addVotes(votesByDate, "2026-03-07", tracks[5].id, 5)

  const { deps, sundayRowsByWeek } = createMockResolverDeps({ votesByDate, tracks })

  const result = await runWeekendResolver({
    runDate: dateFromIso("2026-03-08"),
    deps,
    rapidApiKey: null,
    logger: console,
  })

  assertEquals(result.phase, "sunday")
  assertEquals(result.weekStartDate, "2026-03-02")
  assertEquals(result.written, 5)
  assertEquals(sundayRowsByWeek.get("2026-03-02")?.length ?? 0, 5)

  const { deps: sparseDeps, sundayRowsByWeek: sparseRows } = createMockResolverDeps({
    votesByDate: new Map(),
    tracks,
  })

  await runWeekendResolver({
    runDate: dateFromIso("2026-03-08"),
    deps: sparseDeps,
    rapidApiKey: null,
    logger: console,
  })

  assertEquals(sparseRows.get("2026-03-02")?.length ?? 0, 0)
})

Deno.test("monday phase persists top 3 champions and handles fewer-than-3 results", async () => {
  const sundayTracks = [
    createTrack("sun-a", "sun-sp-a", 1),
    createTrack("sun-b", "sun-sp-b", 2),
    createTrack("sun-c", "sun-sp-c", 3),
    createTrack("sun-d", "sun-sp-d", 4),
  ]
  const votesByDate = new Map<string, string[]>()

  addVotes(votesByDate, "2026-03-08", sundayTracks[0].id, 11)
  addVotes(votesByDate, "2026-03-08", sundayTracks[1].id, 9)
  addVotes(votesByDate, "2026-03-08", sundayTracks[2].id, 8)
  addVotes(votesByDate, "2026-03-08", sundayTracks[3].id, 1)

  const { deps, championsByWeek } = createMockResolverDeps({
    votesByDate,
    tracks: sundayTracks,
  })

  const result = await runWeekendResolver({
    runDate: dateFromIso("2026-03-09"),
    deps,
    rapidApiKey: null,
    logger: console,
  })

  assertEquals(result.phase, "monday")
  assertEquals(result.weekStartDate, "2026-03-09")
  assertEquals(result.written, 3)
  assertEquals(championsByWeek.get("2026-03-09")?.length ?? 0, 3)

  const sparseVotes = new Map<string, string[]>()
  addVotes(sparseVotes, "2026-03-08", sundayTracks[0].id, 1)

  const { deps: sparseDeps, championsByWeek: sparseChampions } = createMockResolverDeps({
    votesByDate: sparseVotes,
    tracks: sundayTracks,
  })

  await runWeekendResolver({
    runDate: dateFromIso("2026-03-09"),
    deps: sparseDeps,
    rapidApiKey: null,
    logger: console,
  })

  assertEquals(sparseChampions.get("2026-03-09")?.length ?? 0, 1)
})

Deno.test("weekday phases return no-op and perform no writes", async () => {
  const { deps, weekendRowsByKey, sundayRowsByWeek, championsByWeek } =
    createMockResolverDeps()

  const result = await runWeekendResolver({
    runDate: dateFromIso("2026-03-10"),
    deps,
    rapidApiKey: null,
    logger: console,
  })

  assertEquals(result.phase, "noop")
  assertEquals(result.written, 0)
  assertEquals(weekendRowsByKey.size, 0)
  assertEquals(sundayRowsByWeek.size, 0)
  assertEquals(championsByWeek.size, 0)
})
