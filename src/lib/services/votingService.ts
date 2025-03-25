
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/utils/deviceIdentification';
import { getUserIpAddress } from '@/lib/utils/ipDetection';

/**
 * Checks if a user has already voted for a specific song
 * @returns The song ID if found, null otherwise
 */
export const getUserVotedSong = async (): Promise<string | null> => {
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
};

/**
 * Gets the number of votes a user has cast based on their IP address
 * @returns Number of votes cast
 */
export const getUserVoteCount = async (): Promise<number> => {
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
};

/**
 * Adds a vote for a song if the user hasn't already voted for it
 * @param songId ID of the song to vote for
 * @returns void
 */
export const upvoteSong = async (songId: string): Promise<void> => {
  try {
    console.log('Upvoting song:', songId);
    
    // Get device ID using enhanced fingerprinting
    const deviceId = await getDeviceId();
    
    if (!deviceId) {
      throw new Error('Could not identify your device. Voting not possible.');
    }
    
    // Get user's IP address
    const ipAddress = await getUserIpAddress();
    
    // Check if user already voted for THIS song
    const { data: existingVote, error: checkExistingError } = await supabase
      .from('song_votes')
      .select('id')
      .or(`device_id.eq.${deviceId},ip_address.eq.${ipAddress}`)
      .eq('song_id', parseInt(songId))
      .maybeSingle();
      
    if (checkExistingError) throw checkExistingError;
    
    // If already voted for this song, throw error
    if (existingVote) {
      throw new Error('You already liked this song');
    }
    
    // Check how many total votes this IP address has
    const voteCount = await getUserVoteCount();
    
    // Limit to 3 votes per IP address
    if (voteCount >= 3) {
      throw new Error('You can only vote for three songs in total');
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
        
    if (error) {
      // If the error is due to unique constraint, handle it
      if (error.code === '23505') { // Unique violation code
        throw new Error('You already liked this song');
      }
      throw error;
    }
    
    // Update the vote count in the LeSongs table manually since we removed the trigger
    // First get the current vote count
    const { data: songData, error: fetchError } = await supabase
      .from('LeSongs')
      .select('votes')
      .eq('id', parseInt(songId))
      .single();
      
    if (fetchError) throw fetchError;
    
    // Then increment the vote count by 1
    const newVoteCount = (songData.votes || 0) + 1;
    
    // Update the song with the new vote count
    const { error: updateError } = await supabase
      .from('LeSongs')
      .update({ 
        votes: newVoteCount, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', parseInt(songId));
      
    if (updateError) throw updateError;
  } catch (error) {
    console.error('Error voting for song:', error);
    throw error;
  }
};

/**
 * Removes all votes for a specific song (admin only)
 * @param songId ID of the song to remove votes for
 * @returns void
 */
export const removeVoteForSong = async (songId: string, isAdmin: boolean): Promise<void> => {
  try {
    if (!isAdmin) {
      throw new Error('Only admins can remove votes');
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
  } catch (error) {
    console.error('Error removing votes for song:', error);
    throw error;
  }
};

/**
 * Resets all votes for all songs (admin only)
 * @returns void
 */
export const resetVotes = async (isAdmin: boolean): Promise<void> => {
  try {
    if (!isAdmin) {
      throw new Error('Only admins can reset votes');
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
  } catch (error) {
    console.error('Error resetting votes:', error);
    throw error;
  }
};
