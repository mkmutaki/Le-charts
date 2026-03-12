import { supabase } from '@/integrations/supabase/client';
import { getLocalDateString } from '@/lib/dateUtils';
import { ScheduledSong } from '@/lib/types';
import { getScheduledTrackVotes } from '@/lib/services/scheduledAlbumService';
import {
  WeekendMode,
  getCurrentWeekendMode,
  getWeekendModeFromLocalDate,
  getWeekStartDateForLocalDate,
} from '@/lib/weekendUtils';
import { createBaseStore, BaseState } from './useBaseStore';

export interface WeeklyChampion {
  weekStartDate: string;
  scheduledTrackId: string;
  finalRank: number;
  voteCount: number;
  trackName: string;
  artistName: string;
  artworkUrl: string | null;
}

type JoinedTrackRow = {
  id: string;
  scheduled_album_id: string;
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  track_number: number;
  duration_ms: number | null;
  artwork_url: string | null;
  preview_url: string | null;
  spotify_url: string | null;
};

type BracketRow = {
  source_date: string;
  day_rank: number;
  scheduled_album_tracks: JoinedTrackRow | JoinedTrackRow[] | null;
};

type SundayFinalistRow = {
  saturday_rank: number;
  scheduled_album_tracks: JoinedTrackRow | JoinedTrackRow[] | null;
};

type WeeklyChampionRow = {
  week_start_date: string;
  final_rank: number;
  vote_count: number;
  scheduled_track_id: string;
  scheduled_album_tracks: JoinedTrackRow | JoinedTrackRow[] | null;
};

interface WeekendState extends BaseState {
  weekendMode: WeekendMode;
  bracketTracks: ScheduledSong[];
  sundayFinalists: ScheduledSong[];
  weeklyChampions: WeeklyChampion[];
  currentBracketDate: string | null;
  currentSundayDate: string | null;
  currentChampionWeekStart: string | null;
  isLoadingBracket: boolean;
  isLoadingFinalists: boolean;
  isLoadingChampions: boolean;
  bracketError: string | null;
  finalistsError: string | null;
  championsError: string | null;
  resolveWeekendMode: (date?: string) => WeekendMode;
  fetchBracketTracks: (
    date?: string,
    options?: { force?: boolean }
  ) => Promise<ScheduledSong[]>;
  fetchSundayFinalists: (
    date?: string,
    options?: { force?: boolean }
  ) => Promise<ScheduledSong[]>;
  fetchWeeklyChampions: (
    date?: string,
    options?: { force?: boolean }
  ) => Promise<WeeklyChampion[]>;
  clearWeekendVotingData: () => void;
}

function unwrapJoinedTrack(
  rowTrack: JoinedTrackRow | JoinedTrackRow[] | null
): JoinedTrackRow | null {
  if (!rowTrack) return null;
  if (Array.isArray(rowTrack)) {
    return rowTrack[0] ?? null;
  }
  return rowTrack;
}

function mapTrackToScheduledSong(
  track: JoinedTrackRow,
  scheduledDate: string,
  voteCount: number,
  sourceDate?: string
): ScheduledSong {
  return {
    id: track.id,
    scheduledAlbumId: track.scheduled_album_id,
    spotifyTrackId: track.spotify_track_id,
    trackName: track.track_name,
    artistName: track.artist_name,
    trackNumber: track.track_number,
    durationMs: track.duration_ms,
    artworkUrl: track.artwork_url,
    previewUrl: track.preview_url,
    spotifyUrl: track.spotify_url,
    votes: voteCount,
    scheduledDate,
    sourceDate,
  };
}

function mapChampionRow(row: WeeklyChampionRow): WeeklyChampion | null {
  const track = unwrapJoinedTrack(row.scheduled_album_tracks);
  if (!track) return null;

  return {
    weekStartDate: row.week_start_date,
    scheduledTrackId: row.scheduled_track_id,
    finalRank: row.final_rank,
    voteCount: row.vote_count,
    trackName: track.track_name,
    artistName: track.artist_name,
    artworkUrl: track.artwork_url,
  };
}

export const useWeekendStore = createBaseStore<WeekendState>(
  (set, get) => ({
    weekendMode: getCurrentWeekendMode(),
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

    resolveWeekendMode: (date?: string) => {
      const targetDate = date || getLocalDateString();
      const resolvedMode = getWeekendModeFromLocalDate(targetDate);

      set({ weekendMode: resolvedMode });
      return resolvedMode;
    },

    fetchBracketTracks: async (date?: string, options = {}) => {
      const { force = false } = options;
      const targetDate = date || getLocalDateString();
      const weekStartDate = getWeekStartDateForLocalDate(targetDate);

      if (!force && get().currentBracketDate === targetDate) {
        return get().bracketTracks;
      }

      set({ isLoadingBracket: true, bracketError: null });

      try {
        const { data, error } = await supabase
          .from('weekend_bracket_tracks')
          .select(
            'source_date,day_rank,scheduled_album_tracks(id,scheduled_album_id,spotify_track_id,track_name,artist_name,track_number,duration_ms,artwork_url,preview_url,spotify_url)'
          )
          .eq('week_start_date', weekStartDate)
          .order('source_date', { ascending: true })
          .order('day_rank', { ascending: true });

        if (error) throw error;

        const voteCounts = await getScheduledTrackVotes(targetDate);

        const tracks: ScheduledSong[] = [];
        for (const row of (data ?? []) as unknown as BracketRow[]) {
          const track = unwrapJoinedTrack(row.scheduled_album_tracks);
          if (!track) continue;

          tracks.push(
            mapTrackToScheduledSong(
              track,
              targetDate,
              voteCounts.get(track.id) || 0,
              row.source_date
            )
          );
        }

        set({
          bracketTracks: tracks,
          currentBracketDate: targetDate,
          isLoadingBracket: false,
          bracketError: null,
        });

        return tracks;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load Saturday bracket tracks';

        set({
          bracketTracks: [],
          isLoadingBracket: false,
          bracketError: message,
        });

        return [];
      }
    },

    fetchSundayFinalists: async (date?: string, options = {}) => {
      const { force = false } = options;
      const targetDate = date || getLocalDateString();
      const weekStartDate = getWeekStartDateForLocalDate(targetDate);

      if (!force && get().currentSundayDate === targetDate) {
        return get().sundayFinalists;
      }

      set({ isLoadingFinalists: true, finalistsError: null });

      try {
        const { data, error } = await supabase
          .from('sunday_finalists')
          .select(
            'saturday_rank,scheduled_album_tracks(id,scheduled_album_id,spotify_track_id,track_name,artist_name,track_number,duration_ms,artwork_url,preview_url,spotify_url)'
          )
          .eq('week_start_date', weekStartDate)
          .order('saturday_rank', { ascending: true });

        if (error) throw error;

        const voteCounts = await getScheduledTrackVotes(targetDate);

        const tracks: ScheduledSong[] = [];
        for (const row of (data ?? []) as unknown as SundayFinalistRow[]) {
          const track = unwrapJoinedTrack(row.scheduled_album_tracks);
          if (!track) continue;

          tracks.push(
            mapTrackToScheduledSong(
              track,
              targetDate,
              voteCounts.get(track.id) || 0
            )
          );
        }

        set({
          sundayFinalists: tracks,
          currentSundayDate: targetDate,
          isLoadingFinalists: false,
          finalistsError: null,
        });

        return tracks;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load Sunday finalists';

        set({
          sundayFinalists: [],
          isLoadingFinalists: false,
          finalistsError: message,
        });

        return [];
      }
    },

    fetchWeeklyChampions: async (date?: string, options = {}) => {
      const { force = false } = options;
      const targetDate = date || getLocalDateString();
      const weekStartDate = getWeekStartDateForLocalDate(targetDate);
      const hasCurrentWeekChampions = get().weeklyChampions.some(
        (champion) => champion.weekStartDate === weekStartDate
      );

      if (
        !force &&
        get().currentChampionWeekStart === weekStartDate &&
        hasCurrentWeekChampions
      ) {
        return get().weeklyChampions;
      }

      set({ isLoadingChampions: true, championsError: null });

      try {
        const fields =
          'week_start_date,final_rank,vote_count,scheduled_track_id,scheduled_album_tracks(id,scheduled_album_id,spotify_track_id,track_name,artist_name,track_number,duration_ms,artwork_url,preview_url,spotify_url)';

        const { data: currentWeekRows, error: currentWeekError } = await supabase
          .from('weekly_champions')
          .select(fields)
          .eq('week_start_date', weekStartDate)
          .order('final_rank', { ascending: true });

        if (currentWeekError) throw currentWeekError;

        let rows = (currentWeekRows ?? []) as unknown as WeeklyChampionRow[];

        if (rows.length === 0) {
          const { data: previousRows, error: previousError } = await supabase
            .from('weekly_champions')
            .select(fields)
            .lt('week_start_date', weekStartDate)
            .order('week_start_date', { ascending: false })
            .order('final_rank', { ascending: true });

          if (previousError) throw previousError;

          const orderedPreviousRows =
            (previousRows ?? []) as unknown as WeeklyChampionRow[];

          const fallbackWeekStart = orderedPreviousRows[0]?.week_start_date ?? null;
          rows = fallbackWeekStart
            ? orderedPreviousRows.filter(
                (row) => row.week_start_date === fallbackWeekStart
              )
            : [];
        }

        const champions = rows
          .map(mapChampionRow)
          .filter((row): row is WeeklyChampion => Boolean(row));

        set({
          weeklyChampions: champions,
          currentChampionWeekStart: weekStartDate,
          isLoadingChampions: false,
          championsError: null,
        });

        return champions;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load weekly champions';

        set({
          weeklyChampions: [],
          isLoadingChampions: false,
          championsError: message,
        });

        return [];
      }
    },

    clearWeekendVotingData: () => {
      set({
        bracketTracks: [],
        sundayFinalists: [],
        currentBracketDate: null,
        currentSundayDate: null,
      });
    },
  }),
  'weekend-store'
);
