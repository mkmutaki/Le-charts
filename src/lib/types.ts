
export interface Song {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  songUrl: string;
  votes: number;
  addedAt: Date;
  votedBy: string[]; // Array of user IDs who voted for this song
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
}
