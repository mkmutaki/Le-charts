import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Song, SongFormData, ScheduledSong } from '../types';
import { convertSupabaseSong } from '../supabase-types';
import { createBaseStore, BaseState } from './useBaseStore';
import { clearSongsCache } from '../serviceWorker';
import { getLocalDateString } from '../dateUtils';
import { 
  getAlbumForDate, 
  getScheduledTrackVotes,
  ScheduledAlbumWithTracks 
} from '../services/scheduledAlbumService';

// Track fetch timestamps to prevent duplicate requests
const lastFetchTimestamp = { current: 0 };
const MIN_FETCH_INTERVAL = 120000; // 120 seconds (2 minutes)

interface AlbumTrackData extends SongFormData {
  itunesTrackId?: string;
  albumName?: string;
  trackNumber?: number;
  trackDurationMs?: number;
}

interface UploadResult {
  added: number;
  duplicates: number;
  failed: number;
  failedTracks?: Array<{ title: string; artist: string; error: string }>;
}

interface SongState extends BaseState {
  songs: Song[];
  scheduledSongs: ScheduledSong[];
  isLoading: boolean;
  currentAlbum: { name: string; artist: string } | null;
  currentScheduledDate: string | null;
  useScheduledAlbums: boolean; // Flag to control which system to use
  fetchSongs: (options?: { force?: boolean }) => Promise<void>;
  fetchScheduledSongs: (date?: string, options?: { force?: boolean }) => Promise<ScheduledSong[]>;
  addSong: (songData: SongFormData, itunesTrackId?: string) => Promise<void>;
  addAlbumTracks: (tracks: AlbumTrackData[]) => Promise<UploadResult>;
  checkExistingTracks: (trackIds: string[]) => Promise<Set<string>>;
  updateSong: (songId: string, songData: SongFormData) => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
  deleteAllSongs: () => Promise<void>;
  getSongsCount: () => Promise<number>;
  setCurrentAlbum: (album: { name: string; artist: string } | null) => void;
  setUseScheduledAlbums: (value: boolean) => void;
}

export const useSongStore = createBaseStore<SongState>(
  (set, get) => ({
    songs: [],
    scheduledSongs: [],
    isLoading: false,
    currentAlbum: null,
    currentScheduledDate: null,
    useScheduledAlbums: true, // Default to new system
    
    setCurrentAlbum: (album) => {
      set({ currentAlbum: album });
    },
    
    setUseScheduledAlbums: (value) => {
      set({ useScheduledAlbums: value });
    },
    
    /**
     * Fetch songs from scheduled_album_tracks for a given date
     * Returns songs with vote counts for the scheduled system
     */
    fetchScheduledSongs: async (date?: string, options = {}) => {
      const { force = false } = options;
      const targetDate = date || getLocalDateString();
      
      // Skip if we already have songs for this date and not forcing
      if (!force && get().currentScheduledDate === targetDate && get().scheduledSongs.length > 0) {
        console.log('Skipping fetchScheduledSongs - already have songs for this date');
        return get().scheduledSongs;
      }
      
      set({ isLoading: true });
      
      try {
        console.log('Fetching scheduled songs for date:', targetDate);
        
        // Get album with tracks for the date
        const albumData = await getAlbumForDate(targetDate);
        
        if (!albumData || !albumData.tracks || albumData.tracks.length === 0) {
          console.log('No scheduled album found for date:', targetDate);
          set({ 
            scheduledSongs: [], 
            currentScheduledDate: targetDate,
            currentAlbum: null,
            isLoading: false 
          });
          return [];
        }
        
        // Get vote counts for tracks
        const voteCounts = await getScheduledTrackVotes(targetDate);
        
        // Convert to ScheduledSong format with vote counts
        const scheduledSongs: ScheduledSong[] = albumData.tracks.map((track) => ({
          id: track.id,
          scheduledAlbumId: track.scheduled_album_id,
          spotifyTrackId: track.spotify_track_id,
          trackName: track.track_name,
          artistName: track.artist_name,
          trackNumber: track.track_number,
          durationMs: track.duration_ms,
          artworkUrl: track.artwork_url,
          previewUrl: track.preview_url,
          spotifyUrl: track.spotify_url,
          votes: voteCounts.get(track.id) || 0,
          scheduledDate: targetDate,
        }));
        
        // Sort by votes (descending), then by track number
        scheduledSongs.sort((a, b) => {
          if (b.votes !== a.votes) return b.votes - a.votes;
          return a.trackNumber - b.trackNumber;
        });
        
        set({ 
          scheduledSongs,
          currentScheduledDate: targetDate,
          currentAlbum: {
            name: albumData.album.album_name,
            artist: albumData.album.artist_name,
          },
          isLoading: false 
        });
        
        return scheduledSongs;
      } catch (error) {
        console.error('Error fetching scheduled songs:', error);
        toast.error('Failed to load songs');
        set({ isLoading: false });
        return [];
      }
    },
    
    fetchSongs: async (options = {}) => {
      const { force = false } = options;
      // Add timestamp-based deduplication
      const now = Date.now();
      if (!force && now - lastFetchTimestamp.current < MIN_FETCH_INTERVAL) {
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
          .order('updated_at', { ascending: false });
          
        if (error) {
          console.error('Error fetching songs with votes:', error);
          throw error;
        }
        
        const songs = songsWithVotes
          .map(songData => {
            const votes = songData.song_votes || [];
            const voteCount = votes.length;
            
            const songObj = convertSupabaseSong(songData);
            songObj.votedBy = votes.map(vote => vote.device_id) || [];
            
            // Use the live vote table as the source of truth
            songObj.votes = voteCount > 0 ? voteCount : songData.votes || 0;
            // Track updated_at for sorting fallback
            songObj.updatedAt = songData.updated_at || songData.created_at;
            
            return songObj;
          })
          // Ensure client-side ordering by votes then recency
          .sort((a, b) => {
            if (b.votes !== a.votes) return b.votes - a.votes;
            const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return bUpdated - aUpdated;
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
        if (!trackIds || trackIds.length === 0) {
          return new Set<string>();
        }

        // Validate track IDs
        const validTrackIds = trackIds.filter(id => id && id.trim() !== '');
        
        if (validTrackIds.length === 0) {
          console.warn('No valid track IDs provided');
          return new Set<string>();
        }
        
        const { data, error } = await supabase
          .from('LeSongs')
          .select('itunes_track_id')
          .in('itunes_track_id', validTrackIds);
          
        if (error) {
          console.error('Error checking existing tracks:', error);
          
          // Don't throw error, just log it and return empty set
          // This prevents the upload flow from breaking
          if (error.message?.includes('network') || error.message?.includes('fetch')) {
            console.warn('Network error while checking existing tracks. Proceeding with upload.');
          }
          
          return new Set<string>();
        }
        
        const existingIds = new Set(
          data
            .map(row => row.itunes_track_id)
            .filter((id): id is string => id !== null && id !== undefined)
        );
        
        return existingIds;
      } catch (error) {
        console.error('Error checking existing tracks:', error);
        // Don't throw - return empty set to allow upload to proceed
        return new Set<string>();
      }
    },
    
    addAlbumTracks: async (tracks: AlbumTrackData[]) => {
      try {
        // Validate input
        if (!tracks || tracks.length === 0) {
          toast.error('No tracks provided');
          return { added: 0, duplicates: 0, failed: 0 };
        }

        // Verify admin status directly from the database before proceeding
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: get().currentUser?.id
        });
        
        if (adminError || !isAdmin) {
          console.error('Error verifying admin status:', adminError);
          toast.error('Only admins can add songs');
          return { added: 0, duplicates: 0, failed: 0 };
        }

        // Validate track data
        const invalidTracks = tracks.filter(track => 
          !track.title || !track.artist || track.title.trim() === '' || track.artist.trim() === ''
        );

        if (invalidTracks.length > 0) {
          console.error('Invalid tracks detected:', invalidTracks);
          toast.error(`${invalidTracks.length} track${invalidTracks.length !== 1 ? 's have' : ' has'} invalid data and will be skipped`);
          // Filter out invalid tracks
          tracks = tracks.filter(track => 
            track.title && track.artist && track.title.trim() !== '' && track.artist.trim() !== ''
          );
          
          if (tracks.length === 0) {
            toast.error('No valid tracks to upload');
            return { added: 0, duplicates: 0, failed: invalidTracks.length };
          }
        }
        
        // Insert new tracks with individual error tracking
        const tracksToInsert = tracks.map(track => ({
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
        
        let addedCount = 0;
        let failedCount = 0;
        const failedTracks: Array<{ title: string; artist: string; error: string }> = [];
          
        if (error) {
          console.error('Error adding album tracks:', error);
          
          // Check for specific error types
          if (error.message?.includes('network') || error.message?.includes('fetch')) {
            toast.error('Network error. Please check your connection and try again.');
            return { added: 0, duplicates: 0, failed: tracks.length };
          }

          if (error.message?.includes('permission') || error.message?.includes('policy')) {
            toast.error('Permission denied. Please ensure you have admin access.');
            return { added: 0, duplicates: 0, failed: tracks.length };
          }
          
          // If batch insert failed, try individual inserts to identify which tracks failed
          console.log('Batch insert failed. Attempting individual inserts...');
          
          for (const track of tracksToInsert) {
            try {
              const { error: individualError } = await supabase
                .from('LeSongs')
                .insert(track)
                .select()
                .single();
              
              if (individualError) {
                throw individualError;
              }
              addedCount++;
            } catch (individualError: any) {
              console.error(`Failed to insert track "${track.song_name}":`, individualError);
              failedCount++;
              
              // Provide specific error message based on error type
              let errorMessage = 'Unknown error';
              if (individualError.message?.includes('duplicate')) {
                errorMessage = 'Track already exists';
              } else if (individualError.message?.includes('constraint')) {
                errorMessage = 'Data validation failed';
              } else if (individualError.message) {
                errorMessage = individualError.message;
              }
              
              failedTracks.push({
                title: track.song_name,
                artist: track.artist,
                error: errorMessage
              });
            }
          }
          
          // If some tracks succeeded, fetch them and update the store
          if (addedCount > 0) {
            await get().fetchSongs();
            
            // Clear the service worker cache for songs
            clearSongsCache();
            
            // Reset the fetch timestamp to allow an immediate fetch
            lastFetchTimestamp.current = 0;
          }
          
          // Show appropriate toast message
          if (addedCount > 0 && failedCount > 0) {
            toast.error(`${addedCount} track${addedCount !== 1 ? 's' : ''} uploaded, but ${failedCount} failed. Please try again.`);
          } else if (failedCount > 0) {
            toast.error(`Failed to upload ${failedCount} track${failedCount !== 1 ? 's' : ''}. Please try again.`);
          }
          
          return { added: addedCount, duplicates: 0, failed: failedCount, failedTracks };
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
          
          addedCount = data.length;
          
          // Clear the service worker cache for songs
          clearSongsCache();
          
          // Reset the fetch timestamp to allow an immediate fetch after adding songs
          lastFetchTimestamp.current = 0;
          
          // Show success message
          toast.success(`Album uploaded! ${addedCount} track${addedCount !== 1 ? 's' : ''} added`);
          
          return { added: addedCount, duplicates: 0, failed: 0 };
        }
        
        return { added: 0, duplicates: 0, failed: 0 };
      } catch (error: any) {
        console.error('Error adding album tracks:', error);
        
        // Provide user-friendly error messages
        let errorMessage = 'Failed to add album tracks';
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message?.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        toast.error(errorMessage);
        return { added: 0, duplicates: 0, failed: tracks.length };
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
    
    deleteAllSongs: async () => {
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
        
        console.log('Deleting all songs from database...');
        
        // First, delete all votes associated with the songs
        const { error: votesError } = await supabase
          .from('song_votes')
          .delete()
          .neq('id', 0); // Delete all votes
          
        if (votesError) {
          console.error('Error deleting votes:', votesError);
          throw votesError;
        }
        
        console.log('All votes cleared');
        
        // Then delete all songs
        const { error } = await supabase
          .from('LeSongs')
          .delete()
          .neq('id', 0); // Delete all rows (using a condition that matches everything)
          
        if (error) {
          console.error('Error deleting all songs:', error);
          throw error;
        }
        
        set({ songs: [] });
        
        // Clear the service worker cache for songs
        clearSongsCache();
        
        // Reset the fetch timestamp to allow an immediate fetch after deleting songs
        lastFetchTimestamp.current = 0;
        
        console.log('All songs deleted successfully');
      } catch (error) {
        console.error('Error deleting all songs:', error);
        toast.error('Failed to delete all songs');
        throw error;
      }
    },
    
    getSongsCount: async () => {
      try {
        const { count, error } = await supabase
          .from('LeSongs')
          .select('*', { count: 'exact', head: true });
          
        if (error) {
          console.error('Error getting songs count:', error);
          return 0;
        }
        
        return count || 0;
      } catch (error) {
        console.error('Error getting songs count:', error);
        return 0;
      }
    },
  }),
  'song-store'
);
