// src/lib/services/itunesService.ts

const ITUNES_SEARCH_BASE_URL = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP_BASE_URL = 'https://itunes.apple.com/lookup';

export interface ITunesAlbum {
  collectionId: number;
  collectionName: string;
  artistName: string;
  artworkUrl100: string;
  artworkUrl60?: string;
  artworkUrl600?: string; // Not always present, need to construct
  trackCount: number;
  releaseDate: string;
  collectionViewUrl: string;
  primaryGenreName: string;
}

export interface ITunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionId: number;
  collectionName: string;
  trackNumber: number;
  trackTimeMillis: number;
  artworkUrl100: string;
  artworkUrl60?: string;
  artworkUrl600?: string; // Construct from artworkUrl100
  previewUrl: string;
  trackViewUrl: string;
  kind: string; // "song" for tracks
}

interface ITunesSearchResponse {
  resultCount: number;
  results: any[];
}

/**
 * Search for albums using iTunes Search API
 * @param query - Search term (album name or artist)
 * @returns Array of album results
 */
export async function searchAlbums(query: string): Promise<ITunesAlbum[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    // Construct URL with proper parameters per documentation
    const params = new URLSearchParams({
      term: query.trim(),
      media: 'music',
      entity: 'album',
      limit: '20',
      country: 'US' // Can be made configurable
    });

    const url = `${ITUNES_SEARCH_BASE_URL}?${params.toString()}`;
    console.log('iTunes Search URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`iTunes API error: ${response.status}`);
    }

    const data: ITunesSearchResponse = await response.json();
    console.log('iTunes Search Response:', data);

    // Filter to only include collection (album) results
    const albums = data.results
      .filter(result => result.wrapperType === 'collection')
      .map(result => ({
        collectionId: result.collectionId,
        collectionName: result.collectionName,
        artistName: result.artistName,
        artworkUrl100: result.artworkUrl100,
        artworkUrl60: result.artworkUrl60,
        // Construct high-res artwork URL (600x600)
        artworkUrl600: result.artworkUrl100?.replace('100x100', '600x600'),
        trackCount: result.trackCount,
        releaseDate: result.releaseDate,
        collectionViewUrl: result.collectionViewUrl,
        primaryGenreName: result.primaryGenreName,
      }));

    return albums;
  } catch (error) {
    console.error('Error searching albums:', error);
    return [];
  }
}

/**
 * Get all tracks for a specific album using iTunes Lookup API
 * @param collectionId - iTunes collection (album) ID
 * @returns Array of track results sorted by track number
 */
export async function getAlbumTracks(collectionId: number): Promise<ITunesTrack[]> {
  try {
    // Use lookup endpoint with entity=song to get tracks
    const params = new URLSearchParams({
      id: collectionId.toString(),
      entity: 'song', // Get songs from this collection
      limit: '200', // Max tracks in an album
    });

    const url = `${ITUNES_LOOKUP_BASE_URL}?${params.toString()}`;
    console.log('iTunes Lookup URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`iTunes API error: ${response.status}`);
    }

    const data: ITunesSearchResponse = await response.json();
    console.log('iTunes Lookup Response:', data);

    // First result is the collection itself, rest are tracks
    const tracks = data.results
      .filter(result => result.wrapperType === 'track' && result.kind === 'song')
      .map(result => ({
        trackId: result.trackId,
        trackName: result.trackName,
        artistName: result.artistName,
        collectionId: result.collectionId,
        collectionName: result.collectionName,
        trackNumber: result.trackNumber || 0,
        trackTimeMillis: result.trackTimeMillis || 0,
        artworkUrl100: result.artworkUrl100,
        artworkUrl60: result.artworkUrl60,
        artworkUrl600: result.artworkUrl100?.replace('100x100', '600x600'),
        previewUrl: result.previewUrl || '',
        trackViewUrl: result.trackViewUrl,
        kind: result.kind,
      }))
      .sort((a, b) => a.trackNumber - b.trackNumber); // Sort by track number

    return tracks;
  } catch (error) {
    console.error('Error fetching album tracks:', error);
    return [];
  }
}

/**
 * Search for albums by artist name
 * @param artistName - Artist name to search
 * @returns Array of album results
 */
export async function searchAlbumsByArtist(artistName: string): Promise<ITunesAlbum[]> {
  if (!artistName || artistName.trim().length === 0) {
    return [];
  }

  try {
    const params = new URLSearchParams({
      term: artistName.trim(),
      media: 'music',
      entity: 'album',
      attribute: 'artistTerm', // Search specifically in artist names
      limit: '50',
      country: 'US',
    });

    const url = `${ITUNES_SEARCH_BASE_URL}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`iTunes API error: ${response.status}`);
    }

    const data: ITunesSearchResponse = await response.json();

    return data.results
      .filter(result => result.wrapperType === 'collection')
      .map(result => ({
        collectionId: result.collectionId,
        collectionName: result.collectionName,
        artistName: result.artistName,
        artworkUrl100: result.artworkUrl100,
        artworkUrl60: result.artworkUrl60,
        artworkUrl600: result.artworkUrl100?.replace('100x100', '600x600'),
        trackCount: result.trackCount,
        releaseDate: result.releaseDate,
        collectionViewUrl: result.collectionViewUrl,
        primaryGenreName: result.primaryGenreName,
      }));
  } catch (error) {
    console.error('Error searching albums by artist:', error);
    return [];
  }
}