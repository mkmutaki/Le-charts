
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
        console.log('Fetching songs...');
        const { data: songsData, error: songsError } = await supabase
          .from('LeSongs')
          .select('*')
          .order('votes', { ascending: false })
          .order('updated_at', { ascending: false });
          
        if (songsError) {
          console.error('Error fetching songs:', songsError);
          throw songsError;
        }
        
        console.log('Songs data:', songsData);
        
        // Important: Always fetch votes data separately
        // and don't depend on currentUser state
        const { data: votesData, error: votesError } = await supabase
          .from('song_votes')
          .select('song_id, device_id');
          
        if (votesError) {
          console.error('Error fetching votes:', votesError);
          throw votesError;
        }
        
        console.log('Votes data:', votesData);
        
        const songs = songsData.map(song => {
          const songObj = convertSupabaseSong(song);
          songObj.votedBy = votesData
            ? votesData
                .filter(vote => vote.song_id === song.id)
                .map(vote => vote.device_id)
            : [];
          
          // Use actual votes count from the votes data
          const actualVotes = votesData
            ? votesData.filter(vote => vote.song_id === song.id).length
            : 0;
          
          // If votes in DB and actual votes differ, use the actual votes
          // This ensures consistency even if the votes in the DB are out of sync
          songObj.votes = actualVotes;
          
          return songObj;
        });
        
        console.log('Processed songs:', songs);
        set({ songs, isLoading: false });
      } catch (error) {
        console.error('Error fetching songs:', error);
        toast.error('Failed to load songs');
        set({ isLoading: false });
      }
    },
    
    addSong: async (songData: SongFormData) => {
      // Use the checkIsAdmin function from the store
      const { currentUser, checkIsAdmin } = get();
      const isAdmin = checkIsAdmin();
      
      console.log('Current user in addSong:', currentUser);
      console.log('Is admin in addSong check?', isAdmin);
      
      if (!isAdmin) {
        toast.error('Only admins can add songs');
        return;
      }
      
      try {
        console.log('Adding song with data:', songData);
        
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
          newSong.votedBy = [];
          
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
      // Use the checkIsAdmin function from the store
      const isAdmin = get().checkIsAdmin();
      
      console.log('Updating song - Is admin?', isAdmin);
      
      if (!isAdmin) {
        toast.error('Only admins can update songs');
        return;
      }
      
      try {
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
        
        set((state) => ({
          songs: state.songs.map(song => 
            song.id === songId
              ? { 
                  ...song, 
                  title: songData.title,
                  artist: songData.artist,
                  coverUrl: songData.coverUrl || '',
                  songUrl: songData.songUrl || '',
                  addedAt: new Date()
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
      // Use the checkIsAdmin function from the store
      const isAdmin = get().checkIsAdmin();
      
      console.log('Deleting song - Is admin?', isAdmin);
      
      if (!isAdmin) {
        toast.error('Only admins can delete songs');
        return;
      }
      
      try {
        console.log('Attempting to delete song with ID:', songId);
        
        const { error } = await supabase
          .from('LeSongs')
          .delete()
          .eq('id', parseInt(songId));
          
        if (error) {
          console.error('Error deleting song:', error);
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
