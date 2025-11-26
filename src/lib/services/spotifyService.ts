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
 * Call Supabase Edge Function with timeout and retry logic
 */
async function callEdgeFunction(body: Record<string, unknown>, retryCount = 0): Promise<unknown> {
  const edgeFunctionUrl = getEdgeFunctionUrl();
  const TIMEOUT_MS = 10000; // 10 seconds
  const MAX_RETRIES = 1;

  // Get Supabase anon key from environment
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!anonKey) {
    throw new Error("VITE_SUPABASE_ANON_KEY not configured in environment variables");
  }
  
  // Create an abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    const response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Spotify API error: ${response.statusText} - ${
          errorData.error || "Unknown error"
        }`
      );
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle timeout or network errors
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        // Timeout occurred
        if (retryCount < MAX_RETRIES) {
          // Exponential backoff: wait 2^retryCount seconds
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.log(`Request timeout. Retrying in ${waitTime}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return callEdgeFunction(body, retryCount + 1);
        }
        throw new Error("Request timed out. Please check your internet connection and try again.");
      }
      
      // Network error
      if (error.message.includes('fetch') || error.message.includes('network')) {
        if (retryCount < MAX_RETRIES) {
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.log(`Network error. Retrying in ${waitTime}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return callEdgeFunction(body, retryCount + 1);
        }
        throw new Error("Network error. Please check your internet connection and try again.");
      }
    }
    
    throw error;
  }
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
  const url = sorted[0].url;
  
  // Validate URL format
  try {
    new URL(url);
    return url;
  } catch (error) {
    console.error('Invalid image URL:', url);
    return "";
  }
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
  
  const url = smallest.url;
  
  // Validate URL format
  try {
    new URL(url);
    return url;
  } catch (error) {
    console.error('Invalid thumbnail URL:', url);
    return "";
  }
}

/**
 * Convert Spotify album to iTunes-compatible format
 */
function convertSpotifyAlbum(album: SpotifyAlbum): ITunesAlbum {
  // Validate required fields
  if (!album.id || !album.name) {
    throw new Error('Album is missing required data');
  }

  const artistName = album.artists?.map((a) => a.name).join(", ") || "Unknown Artist";
  const artworkUrl = getBestImageUrl(album.images);
  const thumbnailUrl = getThumbnailUrl(album.images);

  // Validate we have at least some artwork
  if (!artworkUrl && !thumbnailUrl) {
    console.warn(`Album ${album.name} is missing artwork`);
  }

  return {
    collectionId: album.id,
    collectionName: album.name,
    artistName,
    artworkUrl100: thumbnailUrl,
    artworkUrl600: artworkUrl,
    trackCount: album.total_tracks || 0,
    releaseDate: album.release_date || "",
    collectionViewUrl: album.external_urls?.spotify || "",
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
  // Validate required fields
  if (!track.id || !track.name) {
    throw new Error(`Track is missing required data: ${JSON.stringify(track)}`);
  }

  const artistName = track.artists?.map((a) => a.name).join(", ") || "Unknown Artist";
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
    trackNumber: track.track_number || 0,
    trackTimeMillis: track.duration_ms || 0,
    artworkUrl100: thumbnailUrl,
    artworkUrl600: artworkUrl,
    previewUrl: track.preview_url || "",
    trackViewUrl: track.external_urls?.spotify || "",
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

  if (query.trim().length < 2) {
    throw new Error('Search query must be at least 2 characters long');
  }

  try {
    const response = (await callEdgeFunction({
      action: "search",
      query: query.trim(),
      type: "album",
      market: "US",
      limit: 50, // Request more to account for filtering
    })) as SpotifySearchResponse;

    // Validate response structure
    if (!response || !response.albums || !Array.isArray(response.albums.items)) {
      console.error("Invalid search response structure:", response);
      throw new Error("Unable to search albums at this time. Please try again later.");
    }

    if (response.albums.items.length === 0) {
      return []; // Return empty array, let UI handle empty state
    }

    // Filter: only albums and compilations (no singles)
    const filteredAlbums = response.albums.items.filter(
      (album) => album.album_type === "album" || album.album_type === "compilation"
    );

    // Convert to iTunes format with error handling
    const convertedAlbums: ITunesAlbum[] = [];
    for (const album of filteredAlbums.slice(0, 200)) {
      try {
        convertedAlbums.push(convertSpotifyAlbum(album));
      } catch (error) {
        console.warn(`Skipping album ${album.name} due to conversion error:`, error);
        // Continue with other albums
      }
    }

    return convertedAlbums;
  } catch (error) {
    console.error("Error searching albums:", error);
    if (error instanceof Error) {
      // Re-throw user-friendly errors
      throw error;
    }
    throw new Error("Unable to search albums at this time. Please check your internet connection and try again.");
  }
}

/**
 * Get all tracks for a specific album using Spotify API
 * @param collectionId - Spotify album ID
 * @returns Array of track results sorted by track number
 */
export async function getAlbumTracks(collectionId: string): Promise<ITunesTrack[]> {
  if (!collectionId || collectionId.trim().length === 0) {
    throw new Error("Invalid album ID");
  }

  try {
    // Get full album with tracks included
    const album = (await callEdgeFunction({
      action: "getAlbum",
      albumId: collectionId,
      market: "US",
    })) as SpotifyAlbumResponse;

    // Validate album response
    if (!album || !album.id) {
      console.error("Invalid album response:", album);
      throw new Error("Unable to load this album. It may no longer be available.");
    }

    // Validate tracks exist in response
    if (!album.tracks || !Array.isArray(album.tracks.items)) {
      console.error("Album missing tracks data:", album);
      throw new Error("This album has incomplete data and cannot be uploaded");
    }

    // Check if album has tracks
    if (album.tracks.items.length === 0) {
      throw new Error("This album has no tracks and cannot be uploaded");
    }

    // Validate album has artwork
    if (!album.images || album.images.length === 0) {
      throw new Error("This album is missing artwork and cannot be uploaded");
    }

    // Filter out invalid tracks and validate track data
    const validTracks = album.tracks.items.filter((track) => {
      if (!track || !track.id || !track.name) {
        console.warn("Skipping invalid track:", track);
        return false;
      }
      return true;
    });

    if (validTracks.length === 0) {
      throw new Error("This album has no valid tracks and cannot be uploaded");
    }

    // Convert tracks to iTunes format with error handling
    const convertedTracks: ITunesTrack[] = [];
    for (const track of validTracks) {
      try {
        convertedTracks.push(
          convertSpotifyTrack(track, album.images, album.id, album.name)
        );
      } catch (error) {
        console.warn(`Skipping track ${track.name} due to conversion error:`, error);
        // Continue with other tracks
      }
    }

    if (convertedTracks.length === 0) {
      throw new Error("Unable to process any tracks from this album");
    }

    // Return sorted by track number
    return convertedTracks.sort((a, b) => a.trackNumber - b.trackNumber);
  } catch (error) {
    console.error("Error fetching album tracks:", error);
    if (error instanceof Error) {
      // Re-throw user-friendly errors
      throw error;
    }
    throw new Error("Unable to load album tracks. Please try again later.");
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