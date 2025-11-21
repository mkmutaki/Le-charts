export interface Song {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  songUrl: string;
  votes: number;
  addedAt: Date;
  votedBy: string[]; // Array of user IDs who voted for this song
  albumName?: string;
  albumId?: string;
  itunesTrackId?: string;
  trackNumber?: number;
  trackDurationMs?: number;
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
