
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Song, SongFormData, User } from './types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { convertSupabaseSong } from './supabase-types';

interface SongState {
  songs: Song[];
  currentUser: User | null;
  isLoading: boolean;
  addSong: (songData: SongFormData) => Promise<void>;
  upvoteSong: (songId: string) => Promise<void>;
  resetVotes: () => Promise<void>;
  setCurrentUser: (user: User | null) => void;
  checkIsAdmin: () => boolean;
  fetchSongs: () => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
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
      isLoading: false,
      
      fetchSongs: async () => {
        set({ isLoading: true });
        
        try {
          // Fetch songs from Supabase
          const { data: songsData, error: songsError } = await supabase
            .from('LeSongs')
            .select('*')
            .order('votes', { ascending: false });
            
          if (songsError) {
            throw songsError;
          }
          
          // Fetch votes - note we're making a direct call using the REST API
          // since the song_votes table isn't in the TypeScript schema yet
          const { data: votesData, error: votesError } = await supabase
            .from('song_votes')
            .select('*');
            
          if (votesError) {
            throw votesError;
          }
          
          // Convert songs and add votedBy information
          const songs = songsData.map(song => {
            const songObj = convertSupabaseSong(song);
            // Add votedBy information from votes
            songObj.votedBy = votesData
              .filter(vote => vote.song_id === song.id)
              .map(vote => vote.user_id);
            return songObj;
          });
          
          set({ songs, isLoading: false });
        } catch (error) {
          console.error('Error fetching songs:', error);
          toast.error('Failed to load songs');
          set({ isLoading: false });
        }
      },
      
      addSong: async (songData: SongFormData) => {
        const { currentUser } = get();
        
        if (!currentUser?.isAdmin) {
          toast.error('Only admins can add songs');
          return;
        }
        
        try {
          // Insert using the fields we know exist in the database
          const { data, error } = await supabase
            .from('LeSongs')
            .insert({
              title: songData.title,
              artist: songData.artist,
              cover_url: songData.coverUrl,
              song_url: songData.songUrl
            })
            .select()
            .single();
            
          if (error) {
            throw error;
          }
          
          const newSong = convertSupabaseSong(data);
          
          set((state) => ({ 
            songs: [...state.songs, newSong] 
          }));
          
          toast.success('Song added to the chart!');
        } catch (error) {
          console.error('Error adding song:', error);
          toast.error('Failed to add song');
        }
      },
      
      upvoteSong: async (songId: string) => {
        const { currentUser } = get();
        
        if (!currentUser) {
          toast.error('You need to be logged in to vote');
          return;
        }
        
        try {
          // Direct call to song_votes table using REST API
          const { error } = await supabase
            .from('song_votes')
            .insert({
              song_id: parseInt(songId),
              user_id: currentUser.id
            });
            
          if (error) {
            // If error is about constraint, user has already voted
            if (error.code === '23505') {
              toast.error('You have already voted for this song');
              return;
            }
            throw error;
          }
          
          // Refresh songs to get updated vote counts
          await get().fetchSongs();
          
          toast.success('Vote counted!');
        } catch (error) {
          console.error('Error voting for song:', error);
          toast.error('Failed to vote for song');
        }
      },
      
      deleteSong: async (songId: string) => {
        const { currentUser } = get();
        
        if (!currentUser?.isAdmin) {
          toast.error('Only admins can delete songs');
          return;
        }
        
        try {
          const { error } = await supabase
            .from('LeSongs')
            .delete()
            .eq('id', parseInt(songId));
            
          if (error) {
            throw error;
          }
          
          set((state) => ({
            songs: state.songs.filter(song => song.id !== songId)
          }));
          
          toast.success('Song deleted');
        } catch (error) {
          console.error('Error deleting song:', error);
          toast.error('Failed to delete song');
        }
      },
      
      resetVotes: async () => {
        const { currentUser } = get();
        
        if (!currentUser?.isAdmin) {
          toast.error('Only admins can reset votes');
          return;
        }
        
        try {
          // First delete all votes using direct REST API call
          const { error: votesError } = await supabase
            .from('song_votes')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
            
          if (votesError) {
            throw votesError;
          }
          
          // Then reset vote counts on songs
          const { error: songsError } = await supabase
            .from('LeSongs')
            .update({ votes: 0 })
            .neq('id', 0); // Update all
            
          if (songsError) {
            throw songsError;
          }
          
          // Refresh songs
          await get().fetchSongs();
          
          toast.info('All votes have been reset');
        } catch (error) {
          console.error('Error resetting votes:', error);
          toast.error('Failed to reset votes');
        }
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
