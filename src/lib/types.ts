
export interface Song {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  votes: number;
  addedAt: Date;
}

export interface SongFormData {
  title: string;
  artist: string;
  coverUrl: string;
}
