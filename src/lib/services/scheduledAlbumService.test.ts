import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkDateAvailability,
  convertAlbumToScheduleData,
  convertTracksToScheduleData,
  deleteScheduledAlbum,
  getAlbumForDate,
  getScheduledAlbums,
  getScheduledTrackVotes,
  scheduleAlbum,
  updateScheduledAlbum,
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

  it('refreshes statuses before reading scheduled albums', async () => {
    const scheduledAlbumsTable = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'album-1', scheduled_date: '2026-02-25' }],
        error: null,
      }),
    };
    supabaseMock.rpc.mockResolvedValueOnce({ data: 0, error: null });
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'scheduled_albums' ? scheduledAlbumsTable : {}
    );

    const result = await getScheduledAlbums('all');

    expect(supabaseMock.rpc).toHaveBeenCalledWith('refresh_album_statuses');
    expect(result).toEqual([{ id: 'album-1', scheduled_date: '2026-02-25' }]);
  });

  it('deletes existing album when replaceExisting is true', async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'admin-user-id' } },
    });

    const scheduledAlbumsTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({
        data: { id: 'existing-album-id', album_name: 'Old Album' },
        error: null,
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-scheduled-album-id' },
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
        albumName: 'New Album',
        artistName: 'Artist',
        artworkUrl: 'https://image.test/album.jpg',
        trackCount: 1,
      },
      [
        {
          spotifyTrackId: 'spotify-track-1',
          trackName: 'Track 1',
          artistName: 'Artist',
          trackNumber: 1,
        },
      ],
      '2026-02-25',
      true
    );

    expect(result).toEqual({ success: true, albumId: 'new-scheduled-album-id' });
    expect(scheduledAlbumsTable.delete).toHaveBeenCalledTimes(1);
  });

  it('rolls back album insert when tracks insert fails', async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'admin-user-id' } },
    });

    const rollbackEqMock = vi.fn().mockResolvedValue({ error: null });
    const scheduledAlbumsTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
      delete: vi.fn().mockReturnValue({
        eq: rollbackEqMock,
      }),
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
      insert: vi.fn().mockResolvedValue({
        error: { message: 'tracks insert failed' },
      }),
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
        trackCount: 1,
      },
      [
        {
          spotifyTrackId: 'spotify-track-1',
          trackName: 'Track 1',
          artistName: 'Artist',
          trackNumber: 1,
        },
      ],
      '2026-02-25'
    );

    expect(result).toEqual({
      success: false,
      error: 'Failed to insert tracks: tracks insert failed',
    });
    expect(scheduledAlbumsTable.delete).toHaveBeenCalledTimes(1);
    expect(rollbackEqMock).toHaveBeenCalledWith('id', 'scheduled-album-id');
  });

  it('prevents moving an album to a conflicting date during update', async () => {
    const scheduledAlbumsTable = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValueOnce({
        data: { id: 'album-2', album_name: 'Conflict Album' },
        error: null,
      }),
    };

    supabaseMock.from.mockImplementation((table: string) =>
      table === 'scheduled_albums' ? scheduledAlbumsTable : {}
    );

    const result = await updateScheduledAlbum('album-1', {
      scheduled_date: '2026-02-26',
    });

    expect(result).toEqual({
      success: false,
      error: 'Date 2026-02-26 already has a scheduled album: Conflict Album',
    });
  });

  it('returns service errors from deleteScheduledAlbum', async () => {
    const scheduledAlbumsTable = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        error: { message: 'permission denied' },
      }),
    };

    supabaseMock.from.mockImplementation((table: string) =>
      table === 'scheduled_albums' ? scheduledAlbumsTable : {}
    );

    const result = await deleteScheduledAlbum('album-1');

    expect(result).toEqual({
      success: false,
      error: 'permission denied',
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
