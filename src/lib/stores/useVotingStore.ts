
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
          .eq('user_id', currentUser.id);
          
        if (error) throw error;
        
        // If user has voted for any song, return the first one
        if (data && data.length > 0) {
          return data[0].song_id.toString();
        }
        
        return null;
      } catch (error) {
        console.error('Error getting user voted song:', error);
        return null;
      }
    },
    
    upvoteSong: async (songId: string) => {
      const { currentUser } = get();
      
      if (!currentUser) {
        toast.error('You need to be logged in to vote');
        return;
      }
      
      try {
        console.log('Upvoting song:', songId);
        
        // Check if user already voted for ANY song
        const { data: existingVotes, error: checkError } = await supabase
          .from('song_votes')
          .select('song_id')
          .eq('user_id', currentUser.id);
          
        if (checkError) throw checkError;
        
        // User already voted for this specific song
        if (existingVotes && existingVotes.some(vote => vote.song_id.toString() === songId)) {
          toast.info('You already liked this song');
          return;
        }
        
        // Check if user has voted for any OTHER song (one vote limit)
        if (existingVotes && existingVotes.length > 0) {
          // If the user has voted for a different song, we need to remove that vote first
          const currentVotedSongId = existingVotes[0].song_id.toString();
          
          // Delete the previous vote
          const { error: deleteError } = await supabase
            .from('song_votes')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('song_id', parseInt(currentVotedSongId));
            
          if (deleteError) throw deleteError;
          
          // Update the previous song's vote count directly
          const { data: prevSongData, error: getPrevSongError } = await supabase
            .from('LeSongs')
            .select('votes')
            .eq('id', parseInt(currentVotedSongId))
            .single();
            
          if (getPrevSongError) throw getPrevSongError;
          
          const newPrevVoteCount = Math.max(0, (prevSongData.votes || 1) - 1);
          
          const { error: updatePrevError } = await supabase
            .from('LeSongs')
            .update({ 
              votes: newPrevVoteCount,
              updated_at: new Date().toISOString()
            })
            .eq('id', parseInt(currentVotedSongId));
          
          if (updatePrevError) throw updatePrevError;
        }
        
        // Now add the new vote
        const { error } = await supabase
          .from('song_votes')
          .insert({
            song_id: parseInt(songId),
            user_id: currentUser.id
          });
            
        if (error) throw error;
        
        // Get current vote count
        const { data: songData, error: getSongError } = await supabase
          .from('LeSongs')
          .select('votes')
          .eq('id', parseInt(songId))
          .single();
          
        if (getSongError) throw getSongError;
        
        // Increment vote count
        const newVoteCount = (songData.votes || 0) + 1;
        
        // Update the song's vote count
        const { error: updateError } = await supabase
          .from('LeSongs')
          .update({ 
            votes: newVoteCount,
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
    
    downvoteSong: async (songId: string) => {
      const { currentUser } = get();
      
      if (!currentUser) {
        toast.error('You need to be logged in to remove your vote');
        return;
      }
      
      try {
        console.log('Downvoting song:', songId);
        
        // Check if user has voted for this specific song
        const { data: existingVotes, error: voteCheckError } = await supabase
          .from('song_votes')
          .select('id')
          .eq('user_id', currentUser.id)
          .eq('song_id', parseInt(songId));
          
        if (voteCheckError) throw voteCheckError;
        
        // User hasn't voted for this song
        if (!existingVotes || existingVotes.length === 0) {
          toast.error('You haven\'t liked this song yet');
          return;
        }
        
        // Delete the vote record
        const { error: deleteError } = await supabase
          .from('song_votes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('song_id', parseInt(songId));
          
        if (deleteError) throw deleteError;
        
        // Update the song's vote count directly
        const { data: songData, error: getSongError } = await supabase
          .from('LeSongs')
          .select('votes')
          .eq('id', parseInt(songId))
          .single();
          
        if (getSongError) throw getSongError;
        
        const newVoteCount = Math.max(0, (songData.votes || 1) - 1);
        
        const { error: updateError } = await supabase
          .from('LeSongs')
          .update({ 
            votes: newVoteCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', parseInt(songId));
        
        if (updateError) throw updateError;
        
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
        // Delete all vote records
        const { error: deleteVotesError } = await supabase
          .from('song_votes')
          .delete()
          .neq('user_id', 'dummy');
        
        if (deleteVotesError) throw deleteVotesError;
        
        // Reset all song vote counts
        const { error: resetSongsError } = await supabase
          .from('LeSongs')
          .update({ votes: 0, updated_at: new Date().toISOString() })
          .neq('id', 0);
          
        if (resetSongsError) throw resetSongsError;
        
        toast.info('All votes have been reset');
      } catch (error) {
        console.error('Error resetting votes:', error);
        toast.error('Failed to reset votes');
      }
    },
  }),
  'voting-store'
);
