
import { Song, User } from './types';
import { Database } from '@/integrations/supabase/types';

export type SupabaseSong = Database['public']['Tables']['LeSongs']['Row'];
export type SupabaseSongVote = Database['public']['Tables']['song_votes']['Row'];

// Convert Supabase song to our application Song type
export const convertSupabaseSong = (song: SupabaseSong): Song => {
  return {
    id: song.id.toString(),
    title: song.title || '',
    artist: song.artist || '',
    coverUrl: song.cover_url || '',
    songUrl: song.song_url || '',
    votes: song.votes || 0,
    addedAt: new Date(song.created_at),
    votedBy: [] // This will be populated from the song_votes table
  };
};
