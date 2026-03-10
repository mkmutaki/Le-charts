import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createBaseStore, BaseState } from './useBaseStore';
import { getLocalDateString } from '../dateUtils';
import { isAdminUser } from '../services/adminService';
import { getOrCreateDeviceId } from '../deviceId';
import { getClientFingerprint } from '../fingerprint';

// Track fetch timestamps to prevent duplicate requests
const lastFetchTimestamps = {
  scheduledVotes: 0
};
const MIN_FETCH_INTERVAL = 120000; // 120 seconds (2 minutes)
const submitVoteFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-vote`;

interface VotingState extends BaseState {
  upvoteScheduledTrack: (trackId: string, scheduledDate?: string) => Promise<boolean>;
  getUserVotedScheduledTrack: (scheduledDate?: string) => Promise<string | null>;
  deleteScheduledTrackVotes: (trackId: string, scheduledDate: string) => Promise<boolean>;
  resetScheduledVotes: (scheduledDate: string) => Promise<void>;
  votedScheduledTrackId: string | null;
  currentVoteDate: string | null;
}

type SubmitVoteResponse = {
  success: boolean;
  reason?: 'already_voted_same_track' | 'already_voted_other_track' | 'insert_failed';
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
        const deviceId = getOrCreateDeviceId();
        
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
        
        const deviceId = getOrCreateDeviceId();
        
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

        const clientFingerprint = await getClientFingerprint();

        // Run server-side dedupe and insert through Edge Function.
        const response = await fetch(submitVoteFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            trackId,
            scheduledDate: targetDate,
            deviceId,
            clientFingerprint,
          }),
        });
        
        let submitVoteResponse: SubmitVoteResponse | null = null;
        try {
          submitVoteResponse = await response.json() as SubmitVoteResponse;
        } catch {
          submitVoteResponse = null;
        }
        
        if (!response.ok || !submitVoteResponse?.success) {
          if (submitVoteResponse?.reason === 'already_voted_other_track') {
            toast.info('You can only vote for one song per day');
          } else {
            toast.error('Failed to vote for song');
          }
          return false;
        }
        
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
     * Delete all votes for a scheduled track on a given date
     * Admin only
     */
    deleteScheduledTrackVotes: async (trackId: string, scheduledDate: string) => {
      try {
        const isAdmin = await isAdminUser(get().currentUser?.id);
        if (!isAdmin) {
          toast.error('Only admins can delete votes');
          return false;
        }

        const { error } = await supabase
          .from('song_votes')
          .delete()
          .eq('scheduled_date', scheduledDate)
          .eq('scheduled_track_id', trackId);

        if (error) throw error;

        if (
          get().currentVoteDate === scheduledDate &&
          get().votedScheduledTrackId === trackId
        ) {
          set({ votedScheduledTrackId: null });
        }

        return true;
      } catch (error) {
        console.error('Error deleting track votes:', error);
        toast.error('Failed to delete votes');
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
