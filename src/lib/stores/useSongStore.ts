import { toast } from 'sonner';
import { ScheduledSong } from '../types';
import { createBaseStore, BaseState } from './useBaseStore';
import { getLocalDateString } from '../dateUtils';
import { 
  getAlbumForDate, 
  getScheduledTrackVotes,
} from '../services/scheduledAlbumService';

interface SongState extends BaseState {
  scheduledSongs: ScheduledSong[];
  isLoading: boolean;
  currentAlbum: { name: string; artist: string } | null;
  currentScheduledDate: string | null;
  useScheduledAlbums: boolean;
  fetchScheduledSongs: (date?: string, options?: { force?: boolean }) => Promise<ScheduledSong[]>;
  setCurrentAlbum: (album: { name: string; artist: string } | null) => void;
  setUseScheduledAlbums: (value: boolean) => void;
}

export const useSongStore = createBaseStore<SongState>(
  (set, get) => ({
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
  }),
  'song-store'
);
