// src/lib/services/spotifyService.ts
// Spotify API service that replaces iTunes API
// Uses Supabase Edge Function for secure authentication

const SUPABASE_EDGE_FUNCTION_NAME = 'spotify-search';

// Keep the same interface structure as iTunes for easier migration
export interface ITunesAlbum {
  collectionId: string;
  collectionName: string;
  artistName: string;
  artworkUrl100: string;
  artworkUrl600: string;
  trackCount: number;
  releaseDate: string;
  collectionViewUrl: string;
  primaryGenreName: string;
}

export interface ITunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionId: string;
  collectionName: string;
  trackNumber: number;
  trackTimeMillis: number;
  artworkUrl100: string;
  artworkUrl600: string;
  previewUrl: string;
  trackViewUrl: string;
  kind: string;
}

// Internal Spotify interfaces (for type safety)
interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyArtist {
  id: string;
  name: string;
  external_urls: { spotify: string };
}

interface SpotifyAlbum {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  images: SpotifyImage[];
  total_tracks: number;
  release_date: string;
  album_type: string;
  external_urls: { spotify: string };
  genres?: string[];
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  track_number: number;
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
}

interface SpotifySearchResponse {
  albums: {
    items: SpotifyAlbum[];
  };
}

interface SpotifyAlbumResponse extends SpotifyAlbum {
  tracks: {
    items: SpotifyTrack[];
  };
}

/**
 * Get Edge Function URL from environment
 */
function getEdgeFunctionUrl(): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!baseUrl) {
    throw new Error("VITE_SUPABASE_URL not configured in environment variables");
  }
  return `${baseUrl}/functions/v1/${SUPABASE_EDGE_FUNCTION_NAME}`;
}

/**
 * Call Supabase Edge Function
 */
async function callEdgeFunction(body: Record<string, unknown>): Promise<unknown> {
  const edgeFunctionUrl = getEdgeFunctionUrl();

  // Get Supabase anon key from environment
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!anonKey) {
    throw new Error("VITE_SUPABASE_ANON_KEY not configured in environment variables");
  }
  
  const response = await fetch(edgeFunctionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anonKey}`,
      "apikey": anonKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Spotify API error: ${response.statusText} - ${
        errorData.error || "Unknown error"
      }`
    );
  }

  return await response.json();
}

/**
 * Get the best quality image URL from Spotify
 * Prioritizes largest image (typically 640x640)
 */
function getBestImageUrl(images: SpotifyImage[]): string {
  if (!images || images.length === 0) {
    return "";
  }

  // Sort by size (largest first) and return the URL
  const sorted = [...images].sort((a, b) => (b.height || 0) - (a.height || 0));
  return sorted[0].url;
}

/**
 * Get 100x100 thumbnail URL (for consistency with iTunes interface)
 */
function getThumbnailUrl(images: SpotifyImage[]): string {
  if (images.length === 0) {
    return "";
  }
  
  // Return the smallest image
  const smallest = [...images].sort(
    (a, b) => (a.height || 999) - (b.height || 999)
  )[0];
  return smallest.url;
}

/**
 * Convert Spotify album to iTunes-compatible format
 */
function convertSpotifyAlbum(album: SpotifyAlbum): ITunesAlbum {
  const artistName = album.artists.map((a) => a.name).join(", ");
  const artworkUrl = getBestImageUrl(album.images);
  const thumbnailUrl = getThumbnailUrl(album.images);

  return {
    collectionId: album.id,
    collectionName: album.name,
    artistName,
    artworkUrl100: thumbnailUrl,
    artworkUrl600: artworkUrl,
    trackCount: album.total_tracks,
    releaseDate: album.release_date,
    collectionViewUrl: album.external_urls.spotify,
    primaryGenreName: album.genres?.[0] || "Unknown",
  };
}

/**
 * Convert Spotify track to iTunes-compatible format
 */
function convertSpotifyTrack(
  track: SpotifyTrack,
  albumImages: SpotifyImage[],
  albumId: string,
  albumName: string
): ITunesTrack {
  const artistName = track.artists.map((a) => a.name).join(", ");
  const artworkUrl = getBestImageUrl(albumImages);
  const thumbnailUrl = getThumbnailUrl(albumImages);

  // Convert Spotify string ID to numeric hash for iTunes compatibility
  const trackId = track.id.split('').reduce((hash, char) => {
    return ((hash << 5) - hash + char.charCodeAt(0)) & 0x7fffffff;
  }, 0);

  return {
    trackId: trackId,
    trackName: track.name,
    artistName,
    collectionId: albumId,
    collectionName: albumName,
    trackNumber: track.track_number,
    trackTimeMillis: track.duration_ms,
    artworkUrl100: thumbnailUrl,
    artworkUrl600: artworkUrl,
    previewUrl: track.preview_url || "",
    trackViewUrl: track.external_urls.spotify,
    kind: "song",
  };
}

/**
 * Search for albums using Spotify Search API
 * @param query - Search term (album name or artist)
 * @returns Array of album results
 */
export async function searchAlbums(query: string): Promise<ITunesAlbum[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const response = (await callEdgeFunction({
      action: "search",
      query: query.trim(),
      type: "album",
      market: "US",
      limit: 50, // Request more to account for filtering
    })) as SpotifySearchResponse;

    // Filter: only albums and compilations (no singles)
    const filteredAlbums = response.albums.items.filter(
      (album) => album.album_type === "album" || album.album_type === "compilation"
    );

    // Convert to iTunes format
    return filteredAlbums.slice(0, 200).map((album) => convertSpotifyAlbum(album));
  } catch (error) {
    console.error("Error searching albums:", error);
    return [];
  }
}

/**
 * Get all tracks for a specific album using Spotify API
 * @param collectionId - Spotify album ID
 * @returns Array of track results sorted by track number
 */
export async function getAlbumTracks(collectionId: string): Promise<ITunesTrack[]> {
  try {
    // Get full album with tracks included
    const album = (await callEdgeFunction({
      action: "getAlbum",
      albumId: collectionId,
      market: "US",
    })) as SpotifyAlbumResponse;

    // Convert tracks to iTunes format
    return album.tracks.items
      .map((track) =>
        convertSpotifyTrack(track, album.images, album.id, album.name)
      )
      .sort((a, b) => a.trackNumber - b.trackNumber);
  } catch (error) {
    console.error("Error fetching album tracks:", error);
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
    // Use artist filter in query
    const query = `artist:${artistName.trim()}`;
    return await searchAlbums(query);
  } catch (error) {
    console.error("Error searching albums by artist:", error);
    return [];
  }
}