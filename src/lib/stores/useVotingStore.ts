
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createBaseStore, BaseState } from './useBaseStore';

interface VotingState extends BaseState {
  upvoteSong: (songId: string) => Promise<void>;
  downvoteSong: (songId: string) => Promise<void>;
  resetVotes: () => Promise<void>;
  getUserVotedSong: () => Promise<string | null>;
}

export const useVotingStore = createBaseStore<VotingState>(
  (set, get) => ({
    getUserVotedSong: async () => {
      try {
        // Get user's IP address from a service (this is client-side)
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const { ip } = await ipResponse.json();
        
        if (!ip) {
          console.error('Could not determine IP address');
          return null;
        }
        
        // Check if user has already voted for a song
        const { data, error } = await supabase
          .from('song_votes')
          .select('song_id')
          .eq('ip_address', ip)
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
        
        // Get user's IP address
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const { ip } = await ipResponse.json();
        
        if (!ip) {
          toast.error('Could not determine your device. Voting not possible.');
          return;
        }
        
        // Check if user already voted for ANY song
        const { data: existingVotes, error: checkError } = await supabase
          .from('song_votes')
          .select('song_id')
          .eq('ip_address', ip);
          
        if (checkError) throw checkError;
        
        // User already voted for a song
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
            ip_address: ip
          });
            
        if (error) throw error;
        
        toast.success('Vote counted!');
      } catch (error) {
        console.error('Error voting for song:', error);
        toast.error('Failed to vote for song');
      }
    },
    
    downvoteSong: async (songId: string) => {
      try {
        console.log('Downvoting song:', songId);
        
        // Get user's IP address
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const { ip } = await ipResponse.json();
        
        if (!ip) {
          toast.error('Could not determine your device. Removing vote not possible.');
          return;
        }
        
        // Check if user has voted for this specific song
        const { data: existingVotes, error: voteCheckError } = await supabase
          .from('song_votes')
          .select('id')
          .eq('ip_address', ip)
          .eq('song_id', parseInt(songId));
          
        if (voteCheckError) throw voteCheckError;
        
        // User hasn't voted for this song
        if (!existingVotes || existingVotes.length === 0) {
          toast.info('You haven\'t liked this song');
          return;
        }
        
        // Delete the vote record
        const { error: deleteError } = await supabase
          .from('song_votes')
          .delete()
          .eq('ip_address', ip)
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
        // Delete all vote records
        const { error: deleteVotesError } = await supabase
          .from('song_votes')
          .delete()
          .neq('ip_address', 'dummy');
        
        if (deleteVotesError) throw deleteVotesError;
        
        // Reset all song vote counts (the trigger should handle this, but just to be safe)
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
