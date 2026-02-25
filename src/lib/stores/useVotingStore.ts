import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createBaseStore, BaseState } from './useBaseStore';
import { v4 as uuidv4 } from 'uuid';
import { getLocalDateString } from '../dateUtils';
import { isAdminUser } from '../services/adminService';

// Track fetch timestamps to prevent duplicate requests
const lastFetchTimestamps = {
  scheduledVotes: 0
};
const MIN_FETCH_INTERVAL = 120000; // 120 seconds (2 minutes)

interface VotingState extends BaseState {
  upvoteScheduledTrack: (trackId: string, scheduledDate?: string) => Promise<boolean>;
  getUserVotedScheduledTrack: (scheduledDate?: string) => Promise<string | null>;
  resetScheduledVotes: (scheduledDate: string) => Promise<void>;
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
    
    /**
     * Reset all votes for a specific scheduled date
     * Admin only
     */
    resetScheduledVotes: async (scheduledDate: string) => {
      try {
        const isAdmin = await isAdminUser(get().currentUser?.id);
        if (!isAdmin) {
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
