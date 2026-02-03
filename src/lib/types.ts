export interface Song {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  songUrl: string;
  votes: number;
  addedAt: Date;
  votedBy: string[]; // Array of user IDs who voted for this song
  updatedAt?: string;
  albumName?: string;
  albumId?: string;
  itunesTrackId?: string;
  trackNumber?: number;
  trackDurationMs?: number;
}

// New type for scheduled album tracks
export interface ScheduledSong {
  id: string; // UUID from scheduled_album_tracks
  scheduledAlbumId: string;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  trackNumber: number;
  durationMs: number | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  spotifyUrl: string | null;
  votes: number;
  scheduledDate: string;
}

export interface SongFormData {
  title: string;
  artist: string;
  coverUrl: string;
  songUrl: string;
}

export interface User {
  id: string;
  isAdmin: boolean;
  likedSongs?: string[]; // Add this property to the User interface
}

export interface TilePuzzleState {
  tiles: number[];
  emptyTileIndex: number;
  moveCount: number;
  isWon: boolean;
  isShuffling: boolean;
}
