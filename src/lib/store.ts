
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Song, SongFormData, User } from './types';
import { toast } from 'sonner';

interface SongState {
  songs: Song[];
  currentUser: User | null;
  addSong: (songData: SongFormData) => void;
  upvoteSong: (songId: string) => void;
  resetVotes: () => void;
  setCurrentUser: (user: User | null) => void;
  checkIsAdmin: () => boolean;
}

// Create a dummy user for development
const dummyUser: User = {
  id: 'user-1',
  isAdmin: false
};

// Create a dummy admin for development
const dummyAdmin: User = {
  id: 'admin-1',
  isAdmin: true
};

export const useSongStore = create<SongState>()(
  persist(
    (set, get) => ({
      songs: [],
      currentUser: dummyUser, // Set a default user for development
      
      addSong: (songData: SongFormData) => {
        const newSong: Song = {
          id: crypto.randomUUID(),
          ...songData,
          votes: 0,
          addedAt: new Date(),
          votedBy: [],
        };
        
        set((state) => ({ 
          songs: [...state.songs, newSong] 
        }));
        
        toast.success('Song added to the chart!');
      },
      
      upvoteSong: (songId: string) => {
        const { currentUser, songs } = get();
        
        if (!currentUser) {
          toast.error('You need to be logged in to vote');
          return;
        }
        
        const song = songs.find(s => s.id === songId);
        
        if (song && song.votedBy.includes(currentUser.id)) {
          toast.error('You have already voted for this song');
          return;
        }
        
        set((state) => ({
          songs: state.songs.map((song) => 
            song.id === songId 
              ? { 
                  ...song, 
                  votes: song.votes + 1,
                  votedBy: [...song.votedBy, currentUser.id]
                } 
              : song
          ),
        }));
        
        toast.success('Vote counted!');
      },
      
      resetVotes: () => {
        set((state) => ({
          songs: state.songs.map((song) => ({ ...song, votes: 0, votedBy: [] })),
        }));
        
        toast.info('All votes have been reset');
      },
      
      setCurrentUser: (user) => {
        set({ currentUser: user });
      },
      
      checkIsAdmin: () => {
        const { currentUser } = get();
        return currentUser?.isAdmin || false;
      },
    }),
    {
      name: 'song-store',
    }
  )
);

// For development testing: Function to toggle between admin and regular user
export const toggleAdminMode = () => {
  const { currentUser, setCurrentUser } = useSongStore.getState();
  
  if (currentUser?.isAdmin) {
    setCurrentUser(dummyUser);
    toast.info('Switched to regular user mode');
  } else {
    setCurrentUser(dummyAdmin);
    toast.info('Switched to admin mode');
  }
};
