import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Song, SongFormData } from '../types';
import { convertSupabaseSong } from '../supabase-types';
import { createBaseStore, BaseState } from './useBaseStore';
import { clearSongsCache } from '../serviceWorker';

// Track fetch timestamps to prevent duplicate requests
const lastFetchTimestamp = { current: 0 };
const MIN_FETCH_INTERVAL = 120000; // 120 seconds (2 minutes)

interface AlbumTrackData extends SongFormData {
  itunesTrackId?: string;
  albumName?: string;
  trackNumber?: number;
  trackDurationMs?: number;
}

interface SongState extends BaseState {
  songs: Song[];
  isLoading: boolean;
  currentAlbum: { name: string; artist: string } | null;
  fetchSongs: () => Promise<void>;
  addSong: (songData: SongFormData, itunesTrackId?: string) => Promise<void>;
  addAlbumTracks: (tracks: AlbumTrackData[]) => Promise<{ added: number; duplicates: number }>;
  checkExistingTracks: (trackIds: string[]) => Promise<Set<string>>;
  updateSong: (songId: string, songData: SongFormData) => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
  setCurrentAlbum: (album: { name: string; artist: string } | null) => void;
}

export const useSongStore = createBaseStore<SongState>(
  (set, get) => ({
    songs: [],
    isLoading: false,
    currentAlbum: null,
    
    setCurrentAlbum: (album) => {
      set({ currentAlbum: album });
    },
    
    fetchSongs: async () => {
      // Add timestamp-based deduplication
      const now = Date.now();
      if (now - lastFetchTimestamp.current < MIN_FETCH_INTERVAL) {
        console.log('Skipping fetchSongs - too soon since last fetch');
        return;
      }
      lastFetchTimestamp.current = now;
      
      set({ isLoading: true });
      
      try {
        console.log('Fetching songs...');
        
        // Fetch songs and votes in a single query using JOIN
        // This reduces the number of requests to just one
        const { data: songsWithVotes, error } = await supabase
          .from('LeSongs')
          .select(`
            *,
            song_votes:song_votes(song_id, device_id)
          `)
          .order('votes', { ascending: false })
          .order('updated_at', { ascending: false });
          
        if (error) {
          console.error('Error fetching songs with votes:', error);
          throw error;
        }
        
        const songs = songsWithVotes.map(songData => {
          const song = songData;
          const votes = songData.song_votes || [];
          
          const songObj = convertSupabaseSong(song);
          songObj.votedBy = votes.map(vote => vote.device_id) || [];
          
          // Always use the server's vote count to ensure consistency
          songObj.votes = song.votes || 0;
          
          return songObj;
        });
        
        set({ songs, isLoading: false });
      } catch (error) {
        console.error('Error fetching songs:', error);
        toast.error('Failed to load songs');
        set({ isLoading: false });
      }
    },
    
    addSong: async (songData: SongFormData, itunesTrackId?: string) => {
      try {
        // Verify admin status directly from the database before proceeding
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: get().currentUser?.id
        });
        
        if (adminError || !isAdmin) {
          console.error('Error verifying admin status:', adminError);
          toast.error('Only admins can add songs');
          return;
        }
        
        console.log('Adding song with data:', songData);
        
        const { data, error } = await supabase
          .from('LeSongs')
          .insert({
            song_name: songData.title,
            artist: songData.artist,
            cover_url: songData.coverUrl || null,
            song_url: songData.songUrl || null,
            itunes_track_id: itunesTrackId || null,
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
          
          // Clear the service worker cache for songs
          clearSongsCache();
          
          // Reset the fetch timestamp to allow an immediate fetch after adding a song
          lastFetchTimestamp.current = 0;
          
          toast.success('Song added to the chart!');
          return;
        }
      } catch (error: any) {
        console.error('Error adding song:', error);
        toast.error(`Failed to add song: ${error.message || 'Unknown error'}`);
        throw error;
      }
    },
    
    checkExistingTracks: async (trackIds: string[]) => {
      try {
        if (trackIds.length === 0) {
          return new Set<string>();
        }
        
        const { data, error } = await supabase
          .from('LeSongs')
          .select('itunes_track_id')
          .in('itunes_track_id', trackIds);
          
        if (error) {
          console.error('Error checking existing tracks:', error);
          throw error;
        }
        
        const existingIds = new Set(
          data
            .map(row => row.itunes_track_id)
            .filter((id): id is string => id !== null)
        );
        
        return existingIds;
      } catch (error) {
        console.error('Error checking existing tracks:', error);
        return new Set<string>();
      }
    },
    
    addAlbumTracks: async (tracks: AlbumTrackData[]) => {
      try {
        // Verify admin status directly from the database before proceeding
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: get().currentUser?.id
        });
        
        if (adminError || !isAdmin) {
          console.error('Error verifying admin status:', adminError);
          toast.error('Only admins can add songs');
          return { added: 0, duplicates: 0 };
        }
        
        // Check for existing tracks
        const trackIdsToCheck = tracks
          .map(t => t.itunesTrackId)
          .filter((id): id is string => id !== undefined && id !== null);
        
        const existingTrackIds = await get().checkExistingTracks(trackIdsToCheck);
        
        // Filter out tracks that already exist
        const newTracks = tracks.filter(track => 
          !track.itunesTrackId || !existingTrackIds.has(track.itunesTrackId)
        );
        
        const duplicateCount = tracks.length - newTracks.length;
        
        // If all tracks exist, show message and return
        if (newTracks.length === 0) {
          toast.error('All tracks from this album already exist in the chart');
          return { added: 0, duplicates: duplicateCount };
        }
        
        // Insert new tracks
        const tracksToInsert = newTracks.map(track => ({
          song_name: track.title,
          artist: track.artist,
          cover_url: track.coverUrl || null,
          song_url: track.songUrl || null,
          itunes_track_id: track.itunesTrackId || null,
          album_name: track.albumName || null,
          track_number: track.trackNumber || null,
          track_duration_ms: track.trackDurationMs || null,
          votes: 0,
          updated_at: new Date().toISOString()
        }));
        
        const { data, error } = await supabase
          .from('LeSongs')
          .insert(tracksToInsert)
          .select();
          
        if (error) {
          console.error('Error adding album tracks:', error);
          throw error;
        }
        
        if (data) {
          const newSongs = data.map(songData => {
            const song = convertSupabaseSong(songData);
            song.votedBy = [];
            return song;
          });
          
          set((state) => ({ 
            songs: [...state.songs, ...newSongs] 
          }));
          
          // Clear the service worker cache for songs
          clearSongsCache();
          
          // Reset the fetch timestamp to allow an immediate fetch after adding songs
          lastFetchTimestamp.current = 0;
          
          // Show appropriate toast message
          if (duplicateCount > 0) {
            toast.success(`${newTracks.length} track${newTracks.length !== 1 ? 's' : ''} added, ${duplicateCount} ${duplicateCount !== 1 ? 'were' : 'was'} already in the chart`);
          } else {
            toast.success(`Album uploaded! ${newTracks.length} track${newTracks.length !== 1 ? 's' : ''} added`);
          }
          
          return { added: newTracks.length, duplicates: duplicateCount };
        }
        
        return { added: 0, duplicates: duplicateCount };
      } catch (error: any) {
        console.error('Error adding album tracks:', error);
        toast.error(`Failed to add album tracks: ${error.message || 'Unknown error'}`);
        return { added: 0, duplicates: 0 };
      }
    },
    
    updateSong: async (songId: string, songData: SongFormData) => {
      try {
        // Verify admin status directly from the database before proceeding
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: get().currentUser?.id
        });
        
        if (adminError || !isAdmin) {
          console.error('Error verifying admin status:', adminError);
          toast.error('Only admins can update songs');
          return;
        }
        
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
        
        // Clear the service worker cache for songs
        clearSongsCache();
        
        // Reset the fetch timestamp to allow an immediate fetch after updating a song
        lastFetchTimestamp.current = 0;
        
        toast.success('Song updated successfully');
      } catch (error) {
        console.error('Error updating song:', error);
        toast.error('Failed to update song');
        throw error;
      }
    },
    
    deleteSong: async (songId: string) => {
      try {
        // Verify admin status directly from the database before proceeding
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: get().currentUser?.id
        });
        
        if (adminError || !isAdmin) {
          console.error('Error verifying admin status:', adminError);
          toast.error('Only admins can delete songs');
          return;
        }
        
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
        
        // Clear the service worker cache for songs
        clearSongsCache();
        
        // Reset the fetch timestamp to allow an immediate fetch after deleting a song
        lastFetchTimestamp.current = 0;
        
        toast.success('Song deleted');
      } catch (error) {
        console.error('Error deleting song:', error);
        toast.error('Failed to delete song');
      }
    },
  }),
  'song-store'
);
