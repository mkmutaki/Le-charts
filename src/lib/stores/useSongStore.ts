
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Song, SongFormData } from '../types';
import { convertSupabaseSong } from '../supabase-types';
import { createBaseStore, BaseState } from './useBaseStore';

interface SongState extends BaseState {
  songs: Song[];
  fetchSongs: () => Promise<void>;
  addSong: (songData: SongFormData) => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
}

export const useSongStore = createBaseStore<SongState>(
  (set, get) => ({
    songs: [],
    
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
          console.error('Error adding song:', error);
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
        throw error;
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
  }),
  'song-store'
);
