import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { getAlbumTracks, searchAlbums } from './spotifyService';

const edgeUrl = 'https://test-project.supabase.co/functions/v1/spotify-search';

describe('spotifyService', () => {
  it('normalizes album search results to app shape', async () => {
    server.use(
      http.post(edgeUrl, async () =>
        HttpResponse.json({
          albums: {
            items: [
              {
                id: 'album-1',
                name: 'Album One',
                artists: [{ id: 'artist-1', name: 'Artist One', external_urls: { spotify: 'https://spotify.test/artist-1' } }],
                images: [
                  { url: 'https://image.test/640.jpg', width: 640, height: 640 },
                  { url: 'https://image.test/64.jpg', width: 64, height: 64 },
                ],
                total_tracks: 12,
                release_date: '2020-01-01',
                album_type: 'album',
                external_urls: { spotify: 'https://spotify.test/album-1' },
                genres: ['Hip-Hop'],
              },
              {
                id: 'single-1',
                name: 'Single',
                artists: [{ id: 'artist-1', name: 'Artist One', external_urls: { spotify: 'https://spotify.test/artist-1' } }],
                images: [{ url: 'https://image.test/single.jpg', width: 640, height: 640 }],
                total_tracks: 1,
                release_date: '2020-01-01',
                album_type: 'single',
                external_urls: { spotify: 'https://spotify.test/single-1' },
              },
            ],
          },
        })
      )
    );

    const result = await searchAlbums('album');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      collectionId: 'album-1',
      collectionName: 'Album One',
      artistName: 'Artist One',
      artworkUrl100: 'https://image.test/64.jpg',
      artworkUrl600: 'https://image.test/640.jpg',
      trackCount: 12,
      releaseDate: '2020-01-01',
      collectionViewUrl: 'https://spotify.test/album-1',
      primaryGenreName: 'Hip-Hop',
    });
  });

  it('handles missing preview url and invalid artwork url without throwing', async () => {
    server.use(
      http.post(edgeUrl, async () =>
        HttpResponse.json({
          id: 'album-1',
          name: 'Album One',
          artists: [{ id: 'artist-1', name: 'Artist One', external_urls: { spotify: 'https://spotify.test/artist-1' } }],
          images: [{ url: 'not-a-valid-url', width: 640, height: 640 }],
          total_tracks: 1,
          release_date: '2020-01-01',
          album_type: 'album',
          external_urls: { spotify: 'https://spotify.test/album-1' },
          tracks: {
            items: [
              {
                id: 'track-1',
                name: 'Track One',
                artists: [{ id: 'artist-1', name: 'Artist One', external_urls: { spotify: 'https://spotify.test/artist-1' } }],
                track_number: 1,
                duration_ms: 123000,
                preview_url: null,
                external_urls: { spotify: 'https://spotify.test/track-1' },
              },
            ],
          },
        })
      )
    );

    const result = await getAlbumTracks('album-1');

    expect(result).toHaveLength(1);
    expect(result[0].previewUrl).toBe('');
    expect(result[0].artworkUrl100).toBe('');
    expect(result[0].artworkUrl600).toBe('');
  });

  it('converts Spotify 5xx responses into typed errors', async () => {
    server.use(
      http.post(edgeUrl, async () =>
        HttpResponse.json(
          { error: 'spotify upstream failed' },
          { status: 500, statusText: 'Internal Server Error' }
        )
      )
    );

    await expect(searchAlbums('album')).rejects.toThrow(/Spotify API error/i);
  });

  it('converts network failures into typed errors', async () => {
    server.use(http.post(edgeUrl, async () => HttpResponse.error()));

    await expect(searchAlbums('album')).rejects.toThrow(/Network error/i);
  });
});
