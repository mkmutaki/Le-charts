import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createBaseStore, BaseState } from './useBaseStore';
import { v4 as uuidv4 } from 'uuid';
import { getLocalDateString } from '../dateUtils';

// Track fetch timestamps to prevent duplicate requests
const lastFetchTimestamps = {
  votes: 0,
  scheduledVotes: 0
};
const MIN_FETCH_INTERVAL = 120000; // 120 seconds (2 minutes)

interface VotingState extends BaseState {
  upvoteSong: (songId: string) => Promise<boolean>;
  upvoteScheduledTrack: (trackId: string, scheduledDate?: string) => Promise<boolean>;
  getUserVotedSong: () => Promise<string | null>;
  getUserVotedScheduledTrack: (scheduledDate?: string) => Promise<string | null>;
  resetVotes: () => Promise<void>;
  resetScheduledVotes: (scheduledDate: string) => Promise<void>;
  removeVoteForSong: (songId: string) => Promise<void>;
  votedSongId: string | null;
  votedScheduledTrackId: string | null;
  currentVoteDate: string | null;
}

// Function to get or create a device ID
const getDeviceId = (): string => {
  // Check if a device ID already exists in localStorage
  let deviceId = localStorage.getItem('device_id');
  
  // If not, create a new UUID and store it
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem('device_id', deviceId);
  }
  
  return deviceId;
};

export const useVotingStore = createBaseStore<VotingState>(
  (set, get) => ({
    votedSongId: null,
    votedScheduledTrackId: null,
    currentVoteDate: null,
    
    /**
     * Get the user's voted track for a scheduled date
     * Uses device ID to track votes
     */
    getUserVotedScheduledTrack: async (scheduledDate?: string) => {
      const targetDate = scheduledDate || getLocalDateString();
      
      // If we already have the vote for this date, return it
      if (get().currentVoteDate === targetDate && get().votedScheduledTrackId !== null) {
        return get().votedScheduledTrackId;
      }
      
      // Check if we need to throttle this request
      const now = Date.now();
      if (now - lastFetchTimestamps.scheduledVotes < MIN_FETCH_INTERVAL) {
        console.log('Skipping getUserVotedScheduledTrack - too soon since last fetch');
        return get().votedScheduledTrackId;
      }
      lastFetchTimestamps.scheduledVotes = now;
      
      try {
        const deviceId = getDeviceId();
        
        if (!deviceId) {
          console.error('Could not determine device ID');
          return null;
        }
        
        // Check if user has voted for a scheduled track on this date
        const { data, error } = await supabase
          .from('song_votes')
          .select('scheduled_track_id')
          .eq('device_id', deviceId)
          .eq('scheduled_date', targetDate)
          .not('scheduled_track_id', 'is', null)
          .maybeSingle();
        
        if (error) throw error;
        
        if (data && data.scheduled_track_id) {
          set({ 
            votedScheduledTrackId: data.scheduled_track_id,
            currentVoteDate: targetDate 
          });
          return data.scheduled_track_id;
        }
        
        // No vote found for this date
        set({ votedScheduledTrackId: null, currentVoteDate: targetDate });
        return null;
      } catch (error) {
        console.error('Error getting user voted scheduled track:', error);
        return null;
      }
    },
    
    /**
     * Vote for a scheduled track
     * One vote per device per day
     */
    upvoteScheduledTrack: async (trackId: string, scheduledDate?: string) => {
      try {
        const targetDate = scheduledDate || getLocalDateString();
        console.log('Upvoting scheduled track:', trackId, 'for date:', targetDate);
        
        const deviceId = getDeviceId();
        
        if (!deviceId) {
          toast.error('Could not identify your device. Voting not possible.');
          return false;
        }
        
        // Check local state first
        const currentVotedTrack = get().votedScheduledTrackId;
        const currentVoteDate = get().currentVoteDate;
        
        if (currentVoteDate === targetDate && currentVotedTrack) {
          if (currentVotedTrack === trackId) {
            toast.info('You already liked this song');
          } else {
            toast.info('You can only vote for one song per day');
          }
          return false;
        }
        
        // Check database for existing vote on this date
        const { data: existingVote, error: checkError } = await supabase
          .from('song_votes')
          .select('scheduled_track_id')
          .eq('device_id', deviceId)
          .eq('scheduled_date', targetDate)
          .not('scheduled_track_id', 'is', null)
          .maybeSingle();
        
        if (checkError) throw checkError;
        
        if (existingVote) {
          set({ 
            votedScheduledTrackId: existingVote.scheduled_track_id,
            currentVoteDate: targetDate 
          });
          
          if (existingVote.scheduled_track_id === trackId) {
            toast.info('You already liked this song');
          } else {
            toast.info('You can only vote for one song per day');
          }
          return false;
        }
        
        // Insert the new vote
        const { error } = await supabase
          .from('song_votes')
          .insert({
            scheduled_track_id: trackId,
            scheduled_date: targetDate,
            device_id: deviceId,
          });
        
        if (error) throw error;
        
        // Update local state
        set({ 
          votedScheduledTrackId: trackId,
          currentVoteDate: targetDate 
        });
        
        toast.success('Vote counted!');
        return true;
      } catch (error) {
        console.error('Error voting for scheduled track:', error);
        toast.error('Failed to vote for song');
        return false;
      }
    },
    
    getUserVotedSong: async () => {
      // If we already have the votedSongId in state, return it
      if (get().votedSongId !== null) {
        return get().votedSongId;
      }
      
      // Check if we need to throttle this request
      const now = Date.now();
      if (now - lastFetchTimestamps.votes < MIN_FETCH_INTERVAL) {
        console.log('Skipping getUserVotedSong - too soon since last fetch');
        return get().votedSongId;
      }
      lastFetchTimestamps.votes = now;
      
      try {
        // Get device ID
        const deviceId = getDeviceId();
        
        if (!deviceId) {
          console.error('Could not determine device ID');
          return null;
        }
        
        // Check if user has already voted for a song - only fetch the song_id field
        // Use maybeSingle() to get at most one record
        const { data, error } = await supabase
          .from('song_votes')
          .select('song_id')
          .eq('device_id', deviceId)
          .maybeSingle();
          
        if (error) throw error;
        
        // If user has voted for a song, return its ID and store in state
        if (data) {
          const songId = data.song_id.toString();
          set({ votedSongId: songId });
          return songId;
        }
        
        // No vote found, update state
        set({ votedSongId: null });
        return null;
      } catch (error) {
        console.error('Error getting user voted song:', error);
        return null;
      }
    },
    
    upvoteSong: async (songId: string) => {
      try {
        console.log('Upvoting song:', songId);
        
        // Get device ID
        const deviceId = getDeviceId();
        
        if (!deviceId) {
          toast.error('Could not identify your device. Voting not possible.');
          return false;
        }
        
        // Check if user already voted for ANY song - first check local state
        const currentVotedSong = get().votedSongId;
        if (currentVotedSong) {
          if (currentVotedSong === songId) {
            toast.info('You already liked this song');
          } else {
            toast.info('You can only vote for one song');
          }
          return false;
        }
        
        // If no local state, check database - only fetch the song_id we need
        const { data: existingVotes, error: checkError } = await supabase
          .from('song_votes')
          .select('song_id')
          .eq('device_id', deviceId)
          .maybeSingle();
          
        if (checkError) throw checkError;
        
        // User already voted for a song - votes are immutable
        if (existingVotes) {
          const currentVotedSongId = existingVotes.song_id.toString();
          set({ votedSongId: currentVotedSongId });
          
          if (currentVotedSongId === songId) {
            toast.info('You already liked this song');
          } else {
            toast.info('You can only vote for one song');
          }
          return false;
        }
        
        // Add the new vote
        const { error } = await supabase
          .from('song_votes')
          .insert({
            song_id: parseInt(songId),
            device_id: deviceId
          });
            
        if (error) throw error;
        
        // Update local state with the new vote
        set({ votedSongId: songId });
        
        toast.success('Vote counted!');
        return true;
      } catch (error) {
        console.error('Error voting for song:', error);
        toast.error('Failed to vote for song');
        return false;
      }
    },
    
    removeVoteForSong: async (songId: string) => {
      try {
        // Verify admin status directly from the database before proceeding
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: get().currentUser?.id
        });
        
        if (adminError || !isAdmin) {
          console.error('Error verifying admin status:', adminError);
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
        
        // If the removed song was the currently voted song, clear the state
        if (get().votedSongId === songId) {
          set({ votedSongId: null });
        }
        
        toast.success('Votes removed for this song');
      } catch (error) {
        console.error('Error removing votes for song:', error);
        toast.error('Failed to remove votes');
      }
    },
    
    resetVotes: async () => {
      try {
        // Verify admin status directly from the database before proceeding
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: get().currentUser?.id
        });
        
        if (adminError || !isAdmin) {
          console.error('Error verifying admin status:', adminError);
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
        
        // Reset voted song in state
        set({ votedSongId: null });
        
        toast.success('All votes have been reset');
      } catch (error) {
        console.error('Error resetting votes:', error);
        toast.error('Failed to reset votes');
      }
    },
    
    /**
     * Reset all votes for a specific scheduled date
     * Admin only
     */
    resetScheduledVotes: async (scheduledDate: string) => {
      try {
        // Verify admin status directly from the database before proceeding
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: get().currentUser?.id
        });
        
        if (adminError || !isAdmin) {
          console.error('Error verifying admin status:', adminError);
          toast.error('Only admins can reset votes');
          return;
        }
        
        console.log('Resetting votes for scheduled date:', scheduledDate);
        
        // Delete all votes for the scheduled date
        const { error: deleteError } = await supabase
          .from('song_votes')
          .delete()
          .eq('scheduled_date', scheduledDate)
          .not('scheduled_track_id', 'is', null);
          
        if (deleteError) throw deleteError;
        
        // Reset voted scheduled track in state if it's for the same date
        const currentVoteDate = get().currentVoteDate;
        if (currentVoteDate === scheduledDate) {
          set({ votedScheduledTrackId: null });
        }
        
        console.log('Votes reset for date:', scheduledDate);
      } catch (error) {
        console.error('Error resetting scheduled votes:', error);
        toast.error('Failed to reset votes');
        throw error;
      }
    },
  }),
  'voting-store'
);
