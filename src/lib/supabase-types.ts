
import { Song, User } from './types';
import { Database } from '@/integrations/supabase/types';

export type SupabaseSong = Database['public']['Tables']['LeSongs']['Row'];
export type SupabaseSongVote = {
  id: string;
  song_id: number;
  user_id: string;
  created_at: string;
};

// Convert Supabase song to our application Song type
export const convertSupabaseSong = (song: SupabaseSong): Song => {
  return {
    id: song.id.toString(),
    title: song.song_name || '',
    artist: song.artist || '',
    coverUrl: song.cover_url || '',
    songUrl: song.song_url || '',
    votes: song.votes || 0,
    addedAt: new Date(song.created_at),
    votedBy: [], // This will be populated from the song_votes table
    ...(song.album_name && { albumName: song.album_name }),
    ...(song.album_id && { albumId: song.album_id }),
    ...(song.itunes_track_id && { itunesTrackId: song.itunes_track_id }),
    ...(song.track_number !== null && { trackNumber: song.track_number }),
    ...(song.track_duration_ms !== null && { trackDurationMs: song.track_duration_ms }),
  };
};
