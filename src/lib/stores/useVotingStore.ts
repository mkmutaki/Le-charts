
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
  getUserVoteCount: () => Promise<number>;
}

// Create a stable fingerprint promise that can be reused
const fpPromise = FingerprintJS.load();

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
    
    // Get fingerprint components with default options
    const fp = await fpPromise;
    const result = await fp.get();
    
    // Get the visitorId which is designed to be stable
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

// Function to get user's IP address using an external service
const getUserIpAddress = async (): Promise<string> => {
  try {
    // Use a reliable external service that returns JSON
    const response = await fetch('https://api.ipify.org?format=json');
    if (!response.ok) {
      throw new Error('Failed to fetch IP address');
    }
    
    const data = await response.json();
    console.log('Retrieved IP address:', data.ip);
    return data.ip;
  } catch (error) {
    console.error('Error getting IP address:', error);
    // Return a placeholder if we can't get the IP
    // This will still allow voting, but may not enforce the limit correctly
    return 'unknown-ip';
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
        
        // Get user's IP address
        const ipAddress = await getUserIpAddress();
        
        // Check if user has already voted for a song using both device ID and IP
        const { data, error } = await supabase
          .from('song_votes')
          .select('song_id')
          .eq('device_id', deviceId)
          .eq('ip_address', ipAddress)
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
    
    getUserVoteCount: async () => {
      try {
        // Get user's IP address
        const ipAddress = await getUserIpAddress();
        
        // Count how many votes this IP has used
        const { data, error, count } = await supabase
          .from('song_votes')
          .select('id', { count: 'exact' })
          .eq('ip_address', ipAddress);
          
        if (error) throw error;
        
        return count || 0;
      } catch (error) {
        console.error('Error getting user vote count:', error);
        return 0;
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
        
        // Get user's IP address
        const ipAddress = await getUserIpAddress();
        
        // Check if user already voted for THIS song (using device ID and IP)
        const { data: existingVote, error: checkExistingError } = await supabase
          .from('song_votes')
          .select('id')
          .eq('device_id', deviceId)
          .eq('ip_address', ipAddress)
          .eq('song_id', parseInt(songId))
          .maybeSingle();
          
        if (checkExistingError) throw checkExistingError;
        
        // If already voted for this song, show message and return
        if (existingVote) {
          toast.info('You already liked this song');
          return;
        }
        
        // Check how many total votes this IP address has
        const { count, error: countError } = await supabase
          .from('song_votes')
          .select('id', { count: 'exact' })
          .eq('ip_address', ipAddress);
          
        if (countError) throw countError;
        
        // Limit to 3 votes per IP address
        if (count !== null && count >= 3) {
          toast.info('You can only vote for three songs in total');
          return;
        }
        
        // Add the new vote
        const { error } = await supabase
          .from('song_votes')
          .insert({
            song_id: parseInt(songId),
            device_id: deviceId,
            ip_address: ipAddress,
            voted_at: new Date().toISOString()
          });
            
        if (error) throw error;
        
        // Update the vote count in the LeSongs table
        const { error: updateError } = await supabase
          .from('LeSongs')
          .update({ 
            votes: supabase.rpc('increment', { x: 1 }), 
            updated_at: new Date().toISOString() 
          })
          .eq('id', parseInt(songId));
          
        if (updateError) throw updateError;
        
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
        
        // First get the count of votes for this song to update the song's vote count
        const { count, error: countError } = await supabase
          .from('song_votes')
          .select('id', { count: 'exact' })
          .eq('song_id', parseInt(songId));
          
        if (countError) throw countError;
        
        // Remove all votes for the specified song
        const { error } = await supabase
          .from('song_votes')
          .delete()
          .eq('song_id', parseInt(songId));
          
        if (error) throw error;
        
        // Update the song's vote count to zero
        const { error: updateError } = await supabase
          .from('LeSongs')
          .update({ 
            votes: 0,
            updated_at: new Date().toISOString() 
          })
          .eq('id', parseInt(songId));
          
        if (updateError) throw updateError;
        
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
