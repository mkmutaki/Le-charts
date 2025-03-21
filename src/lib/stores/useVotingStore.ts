
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createBaseStore, BaseState } from './useBaseStore';

interface VotingState extends BaseState {
  upvoteSong: (songId: string) => Promise<void>;
  downvoteSong: (songId: string) => Promise<void>;
  resetVotes: () => Promise<void>;
  checkUserVoteCount: () => Promise<number>;
  getUserVotedSong: () => Promise<string | null>;
  MAX_VOTES_PER_USER: number;
}

export const useVotingStore = createBaseStore<VotingState>(
  (set, get) => ({
    MAX_VOTES_PER_USER: 1,
    
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
    
    getUserVotedSong: async () => {
      const { currentUser } = get();
      
      if (!currentUser) return null;
      
      try {
        const { data, error } = await supabase
          .from('song_votes')
          .select('song_id')
          .eq('user_id', currentUser.id)
          .maybeSingle();
          
        if (error) throw error;
        
        return data?.song_id ? data.song_id.toString() : null;
      } catch (error) {
        console.error('Error getting user voted song:', error);
        return null;
      }
    },
    
    upvoteSong: async (songId: string) => {
      const { currentUser, MAX_VOTES_PER_USER } = get();
      
      if (!currentUser) {
        toast.error('You need to be logged in to vote');
        return;
      }
      
      try {
        // Check if user already voted for this exact song
        const { data: existingVote, error: checkError } = await supabase
          .from('song_votes')
          .select('song_id')
          .eq('user_id', currentUser.id)
          .eq('song_id', parseInt(songId))
          .maybeSingle();
          
        if (checkError) throw checkError;
        
        // User already voted for this song
        if (existingVote) {
          toast.info('You already liked this song');
          return;
        }
        
        // Use the stored procedure to handle voting
        try {
          const { error } = await supabase
            .rpc('vote_for_song', { 
              p_song_id: parseInt(songId),
              p_user_id: currentUser.id
            });
            
          if (error) {
            // This is the expected error when trying to vote for multiple songs
            if (error.message.includes('Cannot vote for a different song')) {
              toast.error('You can only like one song at a time. Unlike your current liked song first.');
              return;
            }
            throw error;
          }
          
          toast.success('Vote counted!');
        } catch (error: any) {
          // Handle the specific error from our RPC function
          if (error.message && error.message.includes('Cannot vote for a different song')) {
            toast.error('You can only like one song at a time. Unlike your current liked song first.');
            return;
          }
          throw error;
        }
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
        // Check if user has voted for this song
        const { data: existingVote, error: voteCheckError } = await supabase
          .from('song_votes')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('song_id', parseInt(songId))
          .maybeSingle();
          
        if (voteCheckError) throw voteCheckError;
        
        // User hasn't voted for this song
        if (!existingVote) {
          toast.error('You haven\'t liked this song yet');
          return;
        }
        
        // Delete the vote record - this triggers the database function to handle vote count
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
