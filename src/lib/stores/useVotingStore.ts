
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createBaseStore, BaseState } from './useBaseStore';
import { v4 as uuidv4 } from 'uuid';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

interface VotingState extends BaseState {
  upvoteSong: (songId: string) => Promise<void>;
  getUserVotedSong: () => Promise<string | null>;
  resetVotes: () => Promise<void>;
  removeVoteForSong: (songId: string) => Promise<void>;
}

// Create a stable fingerprint promise that can be reused
const fpPromise = FingerprintJS.load({
  monitoring: false, // Disable monitoring for privacy
});

// Cache for the fingerprint value
let cachedFingerprint: string | null = null;

// Enhanced fingerprinting with more consistent results across sessions
const getDeviceId = async (): Promise<string> => {
  try {
    // If we already have a cached fingerprint, return it
    if (cachedFingerprint) {
      console.log('Using cached fingerprint:', cachedFingerprint);
      return cachedFingerprint;
    }
    
    // Try to get from sessionStorage first (more persistent in some incognito modes)
    const sessionFingerprint = sessionStorage.getItem('device_fingerprint');
    if (sessionFingerprint) {
      console.log('Using sessionStorage fingerprint:', sessionFingerprint);
      cachedFingerprint = sessionFingerprint;
      return sessionFingerprint;
    }
    
    // Try localStorage as backup
    const localFingerprint = localStorage.getItem('device_id');
    if (localFingerprint) {
      console.log('Using localStorage fingerprint:', localFingerprint);
      // Also store in sessionStorage for redundancy
      try {
        sessionStorage.setItem('device_fingerprint', localFingerprint);
      } catch (e) {
        console.error('Failed to store in sessionStorage:', e);
      }
      cachedFingerprint = localFingerprint;
      return localFingerprint;
    }
    
    console.log('Generating new fingerprint...');
    
    // Get fingerprint components with enhanced stability options
    const fp = await fpPromise;
    const result = await fp.get({
      extendedResult: true // Get more data for better fingerprinting
    });
    
    // Use a combination of components for better stability
    // Take the visitorId as the base
    let deviceId = result.visitorId;
    
    console.log('Generated new fingerprint:', deviceId);
    
    // Store the fingerprint in multiple places for redundancy
    try {
      localStorage.setItem('device_id', deviceId);
      sessionStorage.setItem('device_fingerprint', deviceId);
      
      // Cache for this session
      cachedFingerprint = deviceId;
    } catch (e) {
      console.error('Failed to store fingerprint:', e);
    }
    
    return deviceId;
  } catch (error) {
    console.error('Error generating fingerprint:', error);
    // Fallback to UUID if fingerprinting fails
    const fallbackId = uuidv4();
    try {
      localStorage.setItem('device_id', fallbackId);
      sessionStorage.setItem('device_fingerprint', fallbackId);
    } catch (e) {
      console.error('Failed to store fallback ID:', e);
    }
    return fallbackId;
  }
};

export const useVotingStore = createBaseStore<VotingState>(
  (set, get) => ({
    getUserVotedSong: async () => {
      try {
        // Get device ID using enhanced fingerprinting
        const deviceId = await getDeviceId();
        
        if (!deviceId) {
          console.error('Could not determine device ID');
          return null;
        }
        
        // Check if user has already voted for a song
        const { data, error } = await supabase
          .from('song_votes')
          .select('song_id')
          .eq('device_id', deviceId)
          .maybeSingle();
          
        if (error) throw error;
        
        // If user has voted for a song, return its ID
        if (data) {
          return data.song_id.toString();
        }
        
        return null;
      } catch (error) {
        console.error('Error getting user voted song:', error);
        return null;
      }
    },
    
    upvoteSong: async (songId: string) => {
      try {
        console.log('Upvoting song:', songId);
        
        // Get device ID using enhanced fingerprinting
        const deviceId = await getDeviceId();
        
        if (!deviceId) {
          toast.error('Could not identify your device. Voting not possible.');
          return;
        }
        
        // Check if user already voted for ANY song
        const { data: existingVotes, error: checkError } = await supabase
          .from('song_votes')
          .select('song_id')
          .eq('device_id', deviceId);
          
        if (checkError) throw checkError;
        
        // User already voted for a song - votes are immutable
        if (existingVotes && existingVotes.length > 0) {
          const currentVotedSongId = existingVotes[0].song_id.toString();
          if (currentVotedSongId === songId) {
            toast.info('You already liked this song');
          } else {
            toast.info('You can only vote for one song');
          }
          return;
        }
        
        // Add the new vote
        const { error } = await supabase
          .from('song_votes')
          .insert({
            song_id: parseInt(songId),
            device_id: deviceId
          });
            
        if (error) throw error;
        
        toast.success('Vote counted!');
      } catch (error) {
        console.error('Error voting for song:', error);
        toast.error('Failed to vote for song');
      }
    },
    
    removeVoteForSong: async (songId: string) => {
      try {
        // Using checkIsAdmin() directly to ensure we're checking the current state
        if (!get().checkIsAdmin()) {
          toast.error('Only admins can remove votes');
          return;
        }
        
        console.log('Removing votes for song:', songId);
        
        // Remove all votes for the specified song
        const { error } = await supabase
          .from('song_votes')
          .delete()
          .eq('song_id', parseInt(songId));
          
        if (error) throw error;
        
        toast.success('Votes removed for this song');
      } catch (error) {
        console.error('Error removing votes for song:', error);
        toast.error('Failed to remove votes');
      }
    },
    
    resetVotes: async () => {
      try {
        // Using checkIsAdmin() directly to ensure we're checking the current state
        if (!get().checkIsAdmin()) {
          toast.error('Only admins can reset votes');
          return;
        }
        
        console.log('Resetting all votes');
        
        // Delete all votes from song_votes table first
        const { error: deleteError } = await supabase
          .from('song_votes')
          .delete()
          .neq('id', 0); // This will match all rows
          
        if (deleteError) throw deleteError;
        
        // Reset vote counts in LeSongs table
        const { error: updateError } = await supabase
          .from('LeSongs')
          .update({ votes: 0, updated_at: new Date().toISOString() })
          .neq('id', 0); // This will match all rows
        
        if (updateError) throw updateError;
        
        toast.success('All votes have been reset');
      } catch (error) {
        console.error('Error resetting votes:', error);
        toast.error('Failed to reset votes');
      }
    },
  }),
  'voting-store'
);
