
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Song, SongFormData } from '../types';
import { convertSupabaseSong } from '../supabase-types';
import { createBaseStore, BaseState } from './useBaseStore';

interface SongState extends BaseState {
  songs: Song[];
  fetchSongs: () => Promise<void>;
  addSong: (songData: SongFormData) => Promise<void>;
  updateSong: (songId: string, songData: SongFormData) => Promise<void>;
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
          .order('votes', { ascending: false })
          .order('updated_at', { ascending: false });
          
        if (songsError) {
          throw songsError;
        }
        
        // Fetch votes - using the song_votes table directly
        const { data: votesData, error: votesError } = await supabase
          .from('song_votes')
          .select('song_id, ip_address');
          
        if (votesError) {
          throw votesError;
        }
        
        // Convert songs and add votedBy information
        const songs = songsData.map(song => {
          const songObj = convertSupabaseSong(song);
          // Add votedBy information using IP addresses
          songObj.votedBy = votesData
            ? votesData
                .filter(vote => vote.song_id === song.id)
                .map(vote => vote.ip_address)
            : [];
          
          // Update vote count based on actual entries in song_votes table
          const actualVotes = votesData
            ? votesData.filter(vote => vote.song_id === song.id).length
            : 0;
          
          songObj.votes = actualVotes;
          
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
        console.log('Adding song with data:', songData);
        console.log('Current user:', currentUser);
        
        const { data, error } = await supabase
          .from('LeSongs')
          .insert({
            song_name: songData.title,
            artist: songData.artist,
            cover_url: songData.coverUrl || null,
            song_url: songData.songUrl || null,
            votes: 0,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (error) {
          console.error('Error adding song:', error);
          throw error;
        }
        
        if (data) {
          const newSong = convertSupabaseSong(data);
          newSong.votedBy = []; // Initialize empty votedBy array for new song
          
          set((state) => ({ 
            songs: [...state.songs, newSong] 
          }));
          
          toast.success('Song added to the chart!');
          return;
        }
      } catch (error: any) {
        console.error('Error adding song:', error);
        toast.error(`Failed to add song: ${error.message || 'Unknown error'}`);
        throw error;
      }
    },
    
    updateSong: async (songId: string, songData: SongFormData) => {
      const { currentUser } = get();
      
      if (!currentUser?.isAdmin) {
        toast.error('Only admins can update songs');
        return;
      }
      
      try {
        // Update the song in the database
        const { error } = await supabase
          .from('LeSongs')
          .update({
            song_name: songData.title,
            artist: songData.artist,
            cover_url: songData.coverUrl || null,
            song_url: songData.songUrl || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', parseInt(songId));
          
        if (error) {
          throw error;
        }
        
        // Update the song in the local state
        set((state) => ({
          songs: state.songs.map(song => 
            song.id === songId
              ? { 
                  ...song, 
                  title: songData.title,
                  artist: songData.artist,
                  coverUrl: songData.coverUrl || '',
                  songUrl: songData.songUrl || '',
                  addedAt: new Date() // Update the timestamp
                }
              : song
          )
        }));
        
        toast.success('Song updated successfully');
      } catch (error) {
        console.error('Error updating song:', error);
        toast.error('Failed to update song');
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
