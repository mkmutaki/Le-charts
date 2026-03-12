import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWeekendStore } from './useWeekendStore';

const { supabaseMock, getScheduledTrackVotesMock } = vi.hoisted(() => ({
  supabaseMock: {
    from: vi.fn(),
  },
  getScheduledTrackVotesMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

vi.mock('@/lib/services/scheduledAlbumService', () => ({
  getScheduledTrackVotes: getScheduledTrackVotesMock,
}));

type QueryResult = {
  data: unknown;
  error: unknown | null;
};

function createQueryBuilder(result: QueryResult) {
  type MockBuilder = {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    then: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
    catch: (reject: (reason: unknown) => unknown) => Promise<unknown>;
  };

  const builder: MockBuilder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    order: vi.fn(() => builder),
    in: vi.fn(() => builder),
    then: (resolve: (value: QueryResult) => unknown) =>
      Promise.resolve(result).then(resolve),
    catch: (reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).catch(reject),
  };

  return builder;
}

function queueFromResults(results: QueryResult[]) {
  const queue = [...results];

  supabaseMock.from.mockImplementation(() => {
    const next = queue.shift() ?? { data: [], error: null };
    return createQueryBuilder(next);
  });
}

describe('useWeekendStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    localStorage.clear();

    useWeekendStore.setState({
      ...useWeekendStore.getState(),
      currentUser: null,
      isLoading: false,
      weekendMode: 'weekday',
      bracketTracks: [],
      sundayFinalists: [],
      weeklyChampions: [],
      currentBracketDate: null,
      currentSundayDate: null,
      currentChampionWeekStart: null,
      isLoadingBracket: false,
      isLoadingFinalists: false,
      isLoadingChampions: false,
      bracketError: null,
      finalistsError: null,
      championsError: null,
    });

    getScheduledTrackVotesMock.mockResolvedValue(new Map<string, number>());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves weekendMode correctly for Saturday, Sunday, and weekday dates', () => {
    expect(useWeekendStore.getState().resolveWeekendMode('2026-03-07')).toBe('saturday');
    expect(useWeekendStore.getState().resolveWeekendMode('2026-03-08')).toBe('sunday');
    expect(useWeekendStore.getState().resolveWeekendMode('2026-03-09')).toBe('weekday');
  });

  it('populates bracketTracks from weekend_bracket_tracks with vote counts', async () => {
    queueFromResults([
      {
        data: [
          {
            source_date: '2026-03-02',
            day_rank: 1,
            scheduled_album_tracks: {
              id: 'track-1',
              scheduled_album_id: 'album-1',
              spotify_track_id: 'sp-1',
              track_name: 'Song One',
              artist_name: 'Artist One',
              track_number: 1,
              duration_ms: 120000,
              artwork_url: 'https://img/1',
              preview_url: null,
              spotify_url: null,
            },
          },
        ],
        error: null,
      },
    ]);
    getScheduledTrackVotesMock.mockResolvedValueOnce(
      new Map<string, number>([['track-1', 4]])
    );

    const tracks = await useWeekendStore
      .getState()
      .fetchBracketTracks('2026-03-07', { force: true });

    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe('track-1');
    expect(tracks[0].votes).toBe(4);
    expect(tracks[0].sourceDate).toBe('2026-03-02');
  });

  it('populates sundayFinalists from sunday_finalists rows', async () => {
    queueFromResults([
      {
        data: [
          {
            saturday_rank: 1,
            scheduled_album_tracks: {
              id: 'track-final',
              scheduled_album_id: 'album-final',
              spotify_track_id: 'sp-final',
              track_name: 'Final Song',
              artist_name: 'Final Artist',
              track_number: 2,
              duration_ms: 200000,
              artwork_url: 'https://img/final',
              preview_url: null,
              spotify_url: null,
            },
          },
        ],
        error: null,
      },
    ]);

    const tracks = await useWeekendStore
      .getState()
      .fetchSundayFinalists('2026-03-08', { force: true });

    expect(tracks).toHaveLength(1);
    expect(tracks[0].trackName).toBe('Final Song');
    expect(tracks[0].scheduledDate).toBe('2026-03-08');
  });

  it('fetchWeeklyChampions falls back to previous week when current week has no rows', async () => {
    queueFromResults([
      { data: [], error: null },
      {
        data: [
          {
            week_start_date: '2026-03-02',
            final_rank: 1,
            vote_count: 11,
            scheduled_track_id: 'track-a',
            scheduled_album_tracks: {
              id: 'track-a',
              scheduled_album_id: 'album-a',
              spotify_track_id: 'sp-a',
              track_name: 'Winner A',
              artist_name: 'Artist A',
              track_number: 1,
              duration_ms: 100000,
              artwork_url: 'https://img/a',
              preview_url: null,
              spotify_url: null,
            },
          },
          {
            week_start_date: '2026-03-02',
            final_rank: 2,
            vote_count: 9,
            scheduled_track_id: 'track-b',
            scheduled_album_tracks: {
              id: 'track-b',
              scheduled_album_id: 'album-b',
              spotify_track_id: 'sp-b',
              track_name: 'Winner B',
              artist_name: 'Artist B',
              track_number: 2,
              duration_ms: 100000,
              artwork_url: 'https://img/b',
              preview_url: null,
              spotify_url: null,
            },
          },
          {
            week_start_date: '2026-02-23',
            final_rank: 1,
            vote_count: 15,
            scheduled_track_id: 'old-track',
            scheduled_album_tracks: {
              id: 'old-track',
              scheduled_album_id: 'old-album',
              spotify_track_id: 'old-sp',
              track_name: 'Old Winner',
              artist_name: 'Old Artist',
              track_number: 1,
              duration_ms: 100000,
              artwork_url: 'https://img/old',
              preview_url: null,
              spotify_url: null,
            },
          },
        ],
        error: null,
      },
    ]);

    const champions = await useWeekendStore
      .getState()
      .fetchWeeklyChampions('2026-03-10', { force: true });

    expect(champions).toHaveLength(2);
    expect(champions[0].weekStartDate).toBe('2026-03-02');
    expect(champions[1].trackName).toBe('Winner B');
  });

  it('returns empty arrays (not null) when bracket/finalist/champion data is absent', async () => {
    queueFromResults([
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]);

    const bracket = await useWeekendStore
      .getState()
      .fetchBracketTracks('2026-03-07', { force: true });
    const finalists = await useWeekendStore
      .getState()
      .fetchSundayFinalists('2026-03-08', { force: true });
    const champions = await useWeekendStore
      .getState()
      .fetchWeeklyChampions('2026-03-09', { force: true });

    expect(Array.isArray(bracket)).toBe(true);
    expect(Array.isArray(finalists)).toBe(true);
    expect(Array.isArray(champions)).toBe(true);
    expect(bracket).toHaveLength(0);
    expect(finalists).toHaveLength(0);
    expect(champions).toHaveLength(0);
  });

  it('sets and clears loading/error states when bracket query fails', async () => {
    queueFromResults([
      { data: null, error: new Error('db unavailable') },
    ]);

    const tracks = await useWeekendStore
      .getState()
      .fetchBracketTracks('2026-03-07', { force: true });

    expect(tracks).toEqual([]);
    expect(useWeekendStore.getState().isLoadingBracket).toBe(false);
    expect(useWeekendStore.getState().bracketError).toBe('db unavailable');
  });
});
