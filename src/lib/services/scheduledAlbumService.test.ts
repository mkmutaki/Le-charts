import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkDateAvailability,
  convertAlbumToScheduleData,
  convertTracksToScheduleData,
  getAlbumForDate,
  getScheduledTrackVotes,
  scheduleAlbum,
} from './scheduledAlbumService';

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

describe('scheduledAlbumService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns album + tracks shape from getAlbumForDate', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: {
        album: { id: 'album-1', album_name: 'Graduation', artist_name: 'Kanye West' },
        tracks: [{ id: 'track-1', track_name: 'Good Morning' }],
      },
      error: null,
    });

    const result = await getAlbumForDate('2026-02-25');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('get_album_for_date', {
      target_date: '2026-02-25',
    });
    expect(result).toEqual({
      album: { id: 'album-1', album_name: 'Graduation', artist_name: 'Kanye West' },
      tracks: [{ id: 'track-1', track_name: 'Good Morning' }],
    });
  });

  it('returns null from getAlbumForDate when no album exists', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(getAlbumForDate('2026-02-26')).resolves.toBeNull();
  });

  it('returns track vote counts mapped by track_id', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [
        { track_id: 'track-1', vote_count: 5 },
        { track_id: 'track-2', vote_count: 2 },
      ],
      error: null,
    });

    const result = await getScheduledTrackVotes('2026-02-25');

    expect(result.get('track-1')).toBe(5);
    expect(result.get('track-2')).toBe(2);
    expect(result.size).toBe(2);
  });

  it('returns an empty map when getScheduledTrackVotes errors', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc failed' },
    });

    const result = await getScheduledTrackVotes('2026-02-25');

    expect(result.size).toBe(0);
  });

  it('returns an empty map when there are no votes for the date', async () => {
    supabaseMock.rpc.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const result = await getScheduledTrackVotes('2026-02-25');

    expect(result).toEqual(new Map());
  });

  it('schedules a new album and inserts all tracks', async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'admin-user-id' } },
    });

    const scheduledAlbumsTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'scheduled-album-id' },
            error: null,
          }),
        }),
      }),
    };

    const scheduledAlbumTracksTable = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'scheduled_albums') return scheduledAlbumsTable;
      if (table === 'scheduled_album_tracks') return scheduledAlbumTracksTable;
      return {};
    });

    const result = await scheduleAlbum(
      {
        spotifyAlbumId: 'spotify-album-id',
        albumName: 'Album',
        artistName: 'Artist',
        artworkUrl: 'https://image.test/album.jpg',
        trackCount: 2,
      },
      [
        {
          spotifyTrackId: 'spotify-track-1',
          trackName: 'Track 1',
          artistName: 'Artist',
          trackNumber: 1,
        },
        {
          spotifyTrackId: 'spotify-track-2',
          trackName: 'Track 2',
          artistName: 'Artist',
          trackNumber: 2,
        },
      ],
      '2026-02-25'
    );

    expect(result).toEqual({ success: true, albumId: 'scheduled-album-id' });
    expect(scheduledAlbumsTable.insert).toHaveBeenCalledTimes(1);
    expect(scheduledAlbumTracksTable.insert).toHaveBeenCalledTimes(1);
  });

  it('prevents scheduling when the date already has an album', async () => {
    const scheduledAlbumsTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({
        data: { id: 'existing-id', album_name: 'Already Scheduled' },
        error: null,
      }),
    };

    supabaseMock.from.mockImplementation((table: string) =>
      table === 'scheduled_albums' ? scheduledAlbumsTable : {}
    );

    const result = await scheduleAlbum(
      {
        spotifyAlbumId: 'spotify-album-id',
        albumName: 'New Album',
        artistName: 'Artist',
        artworkUrl: 'https://image.test/album.jpg',
        trackCount: 10,
      },
      [],
      '2026-02-25'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('already has a scheduled album');
  });

  it('returns an album when checkDateAvailability finds one', async () => {
    const scheduledAlbumsTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({
        data: { id: 'album-1', album_name: 'Album Name' },
        error: null,
      }),
    };

    supabaseMock.from.mockImplementation((table: string) =>
      table === 'scheduled_albums' ? scheduledAlbumsTable : {}
    );

    await expect(checkDateAvailability('2026-02-25')).resolves.toEqual({
      id: 'album-1',
      album_name: 'Album Name',
    });
  });

  it('converts Spotify album + track data to schedule payloads', () => {
    const album = convertAlbumToScheduleData({
      collectionId: 'album-id',
      collectionName: 'Album Name',
      artistName: 'Artist Name',
      artworkUrl100: 'https://image.test/100.jpg',
      artworkUrl600: 'https://image.test/600.jpg',
      trackCount: 3,
      releaseDate: '2020-01-01',
      collectionViewUrl: 'https://spotify.test/album-id',
      primaryGenreName: 'Hip-Hop',
    });

    const tracks = convertTracksToScheduleData([
      {
        trackId: 123,
        trackName: 'Track',
        artistName: 'Artist Name',
        collectionId: 'album-id',
        collectionName: 'Album Name',
        trackNumber: 1,
        trackTimeMillis: 180000,
        artworkUrl100: 'https://image.test/100.jpg',
        artworkUrl600: 'https://image.test/600.jpg',
        previewUrl: '',
        trackViewUrl: 'https://spotify.test/track-id',
        kind: 'song',
      },
    ]);

    expect(album).toEqual({
      spotifyAlbumId: 'album-id',
      albumName: 'Album Name',
      artistName: 'Artist Name',
      artworkUrl: 'https://image.test/600.jpg',
      trackCount: 3,
    });
    expect(tracks).toEqual([
      {
        spotifyTrackId: '123',
        trackName: 'Track',
        artistName: 'Artist Name',
        trackNumber: 1,
        durationMs: 180000,
        artworkUrl: 'https://image.test/600.jpg',
        previewUrl: '',
        spotifyUrl: 'https://spotify.test/track-id',
      },
    ]);
  });
});
