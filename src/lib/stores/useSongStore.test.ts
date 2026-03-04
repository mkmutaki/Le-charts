import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSongStore } from './useSongStore';

const { getAlbumForDateMock, getScheduledTrackVotesMock, toastMock } = vi.hoisted(() => ({
  getAlbumForDateMock: vi.fn(),
  getScheduledTrackVotesMock: vi.fn(),
  toastMock: {
    error: vi.fn(),
  },
}));

vi.mock('../services/scheduledAlbumService', () => ({
  getAlbumForDate: getAlbumForDateMock,
  getScheduledTrackVotes: getScheduledTrackVotesMock,
}));

vi.mock('sonner', () => ({
  toast: toastMock,
}));

describe('useSongStore.fetchScheduledSongs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSongStore.setState({
      ...useSongStore.getState(),
      currentUser: null,
      isLoading: false,
      scheduledSongs: [],
      currentAlbum: null,
      currentScheduledDate: null,
      useScheduledAlbums: true,
    });
  });

  it('merges vote counts by track ID and preserves zero-vote tracks', async () => {
    getAlbumForDateMock.mockResolvedValueOnce({
      album: {
        album_name: 'Album A',
        artist_name: 'Artist A',
      },
      tracks: [
        {
          id: 'track-1',
          scheduled_album_id: 'album-1',
          spotify_track_id: 'sp-1',
          track_name: 'Track 1',
          artist_name: 'Artist A',
          track_number: 1,
          duration_ms: 120000,
          artwork_url: null,
          preview_url: null,
          spotify_url: null,
        },
        {
          id: 'track-2',
          scheduled_album_id: 'album-1',
          spotify_track_id: 'sp-2',
          track_name: 'Track 2',
          artist_name: 'Artist A',
          track_number: 2,
          duration_ms: 130000,
          artwork_url: null,
          preview_url: null,
          spotify_url: null,
        },
      ],
    });
    getScheduledTrackVotesMock.mockResolvedValueOnce(
      new Map<string, number>([['track-2', 4]])
    );

    const songs = await useSongStore
      .getState()
      .fetchScheduledSongs('2026-02-27', { force: true });

    expect(songs).toHaveLength(2);
    expect(songs[0].id).toBe('track-2');
    expect(songs[0].votes).toBe(4);
    expect(songs[1].id).toBe('track-1');
    expect(songs[1].votes).toBe(0);
  });

  it('returns an empty list and clears current album when no album is scheduled', async () => {
    getAlbumForDateMock.mockResolvedValueOnce(null);

    const songs = await useSongStore
      .getState()
      .fetchScheduledSongs('2026-02-28', { force: true });

    expect(songs).toEqual([]);
    expect(useSongStore.getState().scheduledSongs).toEqual([]);
    expect(useSongStore.getState().currentAlbum).toBeNull();
  });

  it('degrades gracefully when vote count fetch returns empty map', async () => {
    getAlbumForDateMock.mockResolvedValueOnce({
      album: {
        album_name: 'Album B',
        artist_name: 'Artist B',
      },
      tracks: [
        {
          id: 'track-3',
          scheduled_album_id: 'album-2',
          spotify_track_id: 'sp-3',
          track_name: 'Track 3',
          artist_name: 'Artist B',
          track_number: 1,
          duration_ms: null,
          artwork_url: null,
          preview_url: null,
          spotify_url: null,
        },
      ],
    });
    getScheduledTrackVotesMock.mockResolvedValueOnce(new Map<string, number>());

    const songs = await useSongStore
      .getState()
      .fetchScheduledSongs('2026-03-01', { force: true });

    expect(songs[0].votes).toBe(0);
    expect(useSongStore.getState().isLoading).toBe(false);
  });

  it('handles service failures without crashing and resets loading state', async () => {
    getAlbumForDateMock.mockRejectedValueOnce(new Error('network down'));

    const result = await useSongStore
      .getState()
      .fetchScheduledSongs('2026-03-02', { force: true });

    expect(result).toEqual([]);
    expect(useSongStore.getState().isLoading).toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith('Failed to load songs');
  });
});
