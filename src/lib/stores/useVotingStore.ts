
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createBaseStore, BaseState } from './useBaseStore';

interface VotingState extends BaseState {
  upvoteSong: (songId: string) => Promise<void>;
  downvoteSong: (songId: string) => Promise<void>;
  resetVotes: () => Promise<void>;
  checkUserVoteCount: () => Promise<number>;
  MAX_VOTES_PER_USER: number;
}

export const useVotingStore = createBaseStore<VotingState>(
  (set, get) => ({
    MAX_VOTES_PER_USER: 2,
    
    checkUserVoteCount: async () => {
      const { currentUser } = get();
      
      if (!currentUser) return 0;
      
      try {
        const { data, error } = await supabase
          .from('song_votes')
          .select('song_id')
          .eq('user_id', currentUser.id);
          
        if (error) throw error;
        
        return data.length;
      } catch (error) {
        console.error('Error checking vote count:', error);
        return 0;
      }
    },
    
    upvoteSong: async (songId: string) => {
      const { currentUser, MAX_VOTES_PER_USER } = get();
      
      if (!currentUser) {
        toast.error('You need to be logged in to vote');
        return;
      }
      
      try {
        // Check if user already voted for this song
        const { data: existingVote, error: voteCheckError } = await supabase
          .from('song_votes')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('song_id', parseInt(songId))
          .single();
          
        if (voteCheckError && voteCheckError.code !== 'PGRST116') {
          // PGRST116 is the error code for "no rows returned"
          throw voteCheckError;
        }
        
        if (existingVote) {
          // User already voted for this song, so we'll just return early
          return;
        }
        
        // Check user's total vote count
        const voteCount = await get().checkUserVoteCount();
        
        if (voteCount >= MAX_VOTES_PER_USER) {
          toast.error('Like limit reached (maximum 2 likes)');
          return;
        }
        
        // Use the stored procedure to handle voting
        const { error } = await supabase
          .rpc('vote_for_song', { 
            p_song_id: parseInt(songId),
            p_user_id: currentUser.id
          });
          
        if (error) {
          throw error;
        }
        
        toast.success('Vote counted!');
      } catch (error) {
        console.error('Error voting for song:', error);
        toast.error('Failed to vote for song');
      }
    },
    
    downvoteSong: async (songId: string) => {
      const { currentUser } = get();
      
      if (!currentUser) {
        toast.error('You need to be logged in to remove your vote');
        return;
      }
      
      try {
        // Check if user already voted for this song
        const { data: existingVote, error: voteCheckError } = await supabase
          .from('song_votes')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('song_id', parseInt(songId))
          .single();
          
        if (voteCheckError) {
          if (voteCheckError.code === 'PGRST116') {
            // User hasn't voted for this song
            toast.error('You haven\'t liked this song yet');
            return;
          }
          throw voteCheckError;
        }
        
        // Remove vote from the song
        const { error: updateError } = await supabase
          .from('LeSongs')
          .update({ votes: supabase.rpc('decrement', { x: 1 }) })
          .eq('id', songId);
          
        if (updateError) throw updateError;
        
        // Delete the vote record
        const { error: deleteError } = await supabase
          .from('song_votes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('song_id', parseInt(songId));
          
        if (deleteError) throw deleteError;
        
        toast.success('Vote removed!');
      } catch (error) {
        console.error('Error removing vote:', error);
        toast.error('Failed to remove vote');
      }
    },
    
    resetVotes: async () => {
      const { currentUser } = get();
      
      if (!currentUser?.isAdmin) {
        toast.error('Only admins can reset votes');
        return;
      }
      
      try {
        // Use the stored procedure to reset all votes
        const { error } = await supabase
          .rpc('reset_all_votes');
          
        if (error) {
          throw error;
        }
        
        toast.info('All votes have been reset');
      } catch (error) {
        console.error('Error resetting votes:', error);
        toast.error('Failed to reset votes');
      }
    },
  }),
  'voting-store'
);
