
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
  checkAdminStatus: () => Promise<boolean>;
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
          
          // Fetch votes using the RPC function
          const { data: votesData, error: votesError } = await supabase
            .rpc('get_song_votes');
            
          if (votesError) {
            throw votesError;
          }
          
          // Convert songs and add votedBy information
          const songs = songsData.map(song => {
            const songObj = convertSupabaseSong(song);
            // Add votedBy information from votes
            songObj.votedBy = votesData
              ? votesData
                  .filter(vote => vote.song_id === parseInt(song.id.toString()))
                  .map(vote => vote.user_id)
              : [];
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
          // Insert song data using the fields we know exist
          const { data, error } = await supabase
            .from('LeSongs')
            .insert({
              song_name: songData.title,
              artist: songData.artist,
              cover_url: songData.coverUrl,
              song_url: songData.songUrl,
              votes: 0
            })
            .select()
            .single();
            
          if (error) {
            throw error;
          }
          
          if (data) {
            const newSong = convertSupabaseSong(data);
            
            set((state) => ({ 
              songs: [...state.songs, newSong] 
            }));
            
            toast.success('Song added to the chart!');
          }
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
          // Use the stored procedure to handle voting
          const { error } = await supabase
            .rpc('vote_for_song', { 
              p_song_id: parseInt(songId),
              p_user_id: currentUser.id
            });
            
          if (error) {
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
          // Use the stored procedure to reset all votes
          const { error } = await supabase
            .rpc('reset_all_votes');
            
          if (error) {
            throw error;
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
      
      // New function to check admin status from the database
      checkAdminStatus: async () => {
        const { currentUser } = get();
        
        if (!currentUser) return false;
        
        try {
          const { data, error } = await supabase
            .from('user_roles')
            .select('is_admin')
            .eq('user_id', currentUser.id)
            .single();
            
          if (error) {
            console.error('Error checking admin status:', error);
            return false;
          }
          
          return data?.is_admin || false;
        } catch (error) {
          console.error('Error checking admin status:', error);
          return false;
        }
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
