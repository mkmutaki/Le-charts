
import { toast } from 'sonner';
import { createBaseStore, BaseState } from './useBaseStore';
import {
  getUserVotedSong,
  getUserVoteCount,
  upvoteSong as upvoteSongService,
  removeVoteForSong as removeVoteService,
  resetVotes as resetVotesService
} from '@/lib/services/votingService';

interface VotingState extends BaseState {
  upvoteSong: (songId: string) => Promise<void>;
  getUserVotedSong: () => Promise<string | null>;
  resetVotes: () => Promise<void>;
  removeVoteForSong: (songId: string) => Promise<void>;
  getUserVoteCount: () => Promise<number>;
}

export const useVotingStore = createBaseStore<VotingState>(
  (set, get) => ({
    getUserVotedSong: async () => {
      try {
        return await getUserVotedSong();
      } catch (error) {
        console.error('Error in getUserVotedSong:', error);
        return null;
      }
    },
    
    getUserVoteCount: async () => {
      try {
        return await getUserVoteCount();
      } catch (error) {
        console.error('Error in getUserVoteCount:', error);
        return 0;
      }
    },
    
    upvoteSong: async (songId: string) => {
      try {
        await upvoteSongService(songId);
        toast.success('Vote counted!');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to vote for song';
        console.error('Error upvoting song:', error);
        
        // Show different toast messages based on known error conditions
        if (errorMessage.includes('already liked')) {
          toast.info('You already liked this song');
        } else if (errorMessage.includes('three songs')) {
          toast.info('You can only vote for three songs in total');
        } else {
          toast.error(errorMessage);
        }
      }
    },
    
    removeVoteForSong: async (songId: string) => {
      try {
        // Using checkIsAdmin() directly to ensure we're checking the current state
        const isAdmin = get().checkIsAdmin();
        await removeVoteService(songId, isAdmin);
        toast.success('Votes removed for this song');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to remove votes';
        console.error('Error removing votes for song:', error);
        toast.error(errorMessage);
      }
    },
    
    resetVotes: async () => {
      try {
        // Using checkIsAdmin() directly to ensure we're checking the current state
        const isAdmin = get().checkIsAdmin();
        await resetVotesService(isAdmin);
        toast.success('All votes have been reset');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to reset votes';
        console.error('Error resetting votes:', error);
        toast.error(errorMessage);
      }
    },
  }),
  'voting-store'
);
