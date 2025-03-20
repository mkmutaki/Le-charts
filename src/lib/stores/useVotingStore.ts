
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createBaseStore, BaseState } from './useBaseStore';
import { useSongStore } from './useSongStore';

interface VotingState extends BaseState {
  upvoteSong: (songId: string) => Promise<void>;
  resetVotes: () => Promise<void>;
}

export const useVotingStore = createBaseStore<VotingState>(
  (set, get) => ({
    upvoteSong: async (songId: string) => {
      const { currentUser } = get();
      const { fetchSongs } = useSongStore.getState();
      
      if (!currentUser) {
        toast.error('You need to be logged in to vote');
        return;
      }
      
      try {
        // Use the stored procedure to handle voting
        const { error } = await supabase
          .rpc('vote_for_song', { 
            p_song_id: parseInt(songId),
            p_user_id: currentUser.id
          });
          
        if (error) {
          throw error;
        }
        
        // Refresh songs to get updated vote counts
        await fetchSongs();
        
        toast.success('Vote counted!');
      } catch (error) {
        console.error('Error voting for song:', error);
        toast.error('Failed to vote for song');
      }
    },
    
    resetVotes: async () => {
      const { currentUser } = get();
      const { fetchSongs } = useSongStore.getState();
      
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
        
        // Refresh songs
        await fetchSongs();
        
        toast.info('All votes have been reset');
      } catch (error) {
        console.error('Error resetting votes:', error);
        toast.error('Failed to reset votes');
      }
    },
  }),
  'voting-store'
);
