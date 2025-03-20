
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Song, SongFormData } from './types';
import { toast } from 'sonner';

interface SongState {
  songs: Song[];
  addSong: (songData: SongFormData) => void;
  upvoteSong: (songId: string) => void;
  resetVotes: () => void;
}

export const useSongStore = create<SongState>()(
  persist(
    (set) => ({
      songs: [],
      
      addSong: (songData: SongFormData) => {
        const newSong: Song = {
          id: crypto.randomUUID(),
          ...songData,
          votes: 0,
          addedAt: new Date(),
        };
        
        set((state) => ({ 
          songs: [...state.songs, newSong] 
        }));
        
        toast.success('Song added to the chart!');
      },
      
      upvoteSong: (songId: string) => {
        set((state) => ({
          songs: state.songs.map((song) => 
            song.id === songId 
              ? { ...song, votes: song.votes + 1 } 
              : song
          ),
        }));
      },
      
      resetVotes: () => {
        set((state) => ({
          songs: state.songs.map((song) => ({ ...song, votes: 0 })),
        }));
        
        toast.info('All votes have been reset');
      },
    }),
    {
      name: 'song-store',
    }
  )
);
