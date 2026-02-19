// src/lib/services/scheduledAlbumService.ts
// Service layer for scheduled album operations

import { supabase } from '@/integrations/supabase/client';
import { ITunesAlbum, ITunesTrack } from './spotifyService';

// Types for scheduled albums
export interface ScheduledAlbum {
  id: string;
  spotify_album_id: string;
  album_name: string;
  artist_name: string;
  artwork_url: string;
  track_count: number;
  scheduled_date: string;
  status: 'pending' | 'current' | 'completed';
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ScheduledAlbumTrack {
  id: string;
  scheduled_album_id: string;
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  track_number: number;
  duration_ms: number | null;
  artwork_url: string | null;
  preview_url: string | null;
  spotify_url: string | null;
  created_at: string;
}

export interface ScheduledAlbumWithTracks {
  album: ScheduledAlbum;
  tracks: ScheduledAlbumTrack[];
}

export interface ScheduleAlbumData {
  spotifyAlbumId: string;
  albumName: string;
  artistName: string;
  artworkUrl: string;
  trackCount: number;
}

export interface ScheduleTrackData {
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  trackNumber: number;
  durationMs?: number;
  artworkUrl?: string;
  previewUrl?: string;
  spotifyUrl?: string;
}

/**
 * Schedule an album for a specific date
 * Saves album metadata and all tracks to the database
 */
export async function scheduleAlbum(
  albumData: ScheduleAlbumData,
  tracks: ScheduleTrackData[],
  scheduledDate: string,
  replaceExisting: boolean = false
): Promise<{ success: boolean; albumId?: string; error?: string }> {
  try {
    // Check if date already has a scheduled album
    const existingAlbum = await checkDateAvailability(scheduledDate);
    
    if (existingAlbum && !replaceExisting) {
      return {
        success: false,
        error: `Date ${scheduledDate} already has a scheduled album: ${existingAlbum.album_name}`,
      };
    }
    
    // If replacing, delete the existing album first (cascade will delete tracks)
    if (existingAlbum && replaceExisting) {
      const deleteResult = await deleteScheduledAlbum(existingAlbum.id);
      if (!deleteResult.success) {
        return {
          success: false,
          error: `Failed to replace existing album: ${deleteResult.error}`,
        };
      }
    }
    
    // Get current user ID for audit
    const { data: { user } } = await supabase.auth.getUser();
    
    // Insert the album
    const { data: albumRow, error: albumError } = await supabase
      .from('scheduled_albums')
      .insert({
        spotify_album_id: albumData.spotifyAlbumId,
        album_name: albumData.albumName,
        artist_name: albumData.artistName,
        artwork_url: albumData.artworkUrl,
        track_count: albumData.trackCount,
        scheduled_date: scheduledDate,
        status: 'pending',
        created_by: user?.id || null,
      })
      .select()
      .single();
    
    if (albumError) {
        console.log(user)
      console.error('Error inserting scheduled album:', albumError);
      return {
        success: false,
        error: albumError.message,
      };
    }
    
    // Insert all tracks
    const trackInserts = tracks.map((track) => ({
      scheduled_album_id: albumRow.id,
      spotify_track_id: track.spotifyTrackId,
      track_name: track.trackName,
      artist_name: track.artistName,
      track_number: track.trackNumber,
      duration_ms: track.durationMs || null,
      artwork_url: track.artworkUrl || null,
      preview_url: track.previewUrl || null,
      spotify_url: track.spotifyUrl || null,
    }));
    
    const { error: tracksError } = await supabase
      .from('scheduled_album_tracks')
      .insert(trackInserts);
    
    if (tracksError) {
      console.error('Error inserting tracks:', tracksError);
      // Rollback: delete the album (cascade will clean up any partial track inserts)
      await supabase.from('scheduled_albums').delete().eq('id', albumRow.id);
      return {
        success: false,
        error: `Failed to insert tracks: ${tracksError.message}`,
      };
    }
    
    return {
      success: true,
      albumId: albumRow.id,
    };
  } catch (error) {
    console.error('Error scheduling album:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get all scheduled albums with optional status filter
 * Defaults to 'pending' status
 */
export async function getScheduledAlbums(
  statusFilter: 'pending' | 'completed' | 'all' = 'all'
): Promise<ScheduledAlbum[]> {
  try {
    // Refresh album statuses server-side (keeps DB consistent for other consumers)
    await supabase.rpc('refresh_album_statuses');
    
    const query = supabase
      .from('scheduled_albums')
      .select('*')
      .order('scheduled_date', { ascending: true });
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching scheduled albums:', error);
      return [];
    }
    
    return data as ScheduledAlbum[];
  } catch (error) {
    console.error('Error fetching scheduled albums:', error);
    return [];
  }
}

/**
 * Get the album scheduled for a specific date with all its tracks
 * Uses the RPC function for optimized querying
 */
export async function getAlbumForDate(
  date: string
): Promise<ScheduledAlbumWithTracks | null> {
  try {
    const { data, error } = await supabase.rpc('get_album_for_date', {
      target_date: date,
    });
    
    if (error) {
      console.error('Error fetching album for date:', error);
      return null;
    }
    
    if (!data || !data.album) {
      return null;
    }
    
    return {
      album: data.album as ScheduledAlbum,
      tracks: (data.tracks || []) as ScheduledAlbumTrack[],
    };
  } catch (error) {
    console.error('Error fetching album for date:', error);
    return null;
  }
}

/**
 * Update a scheduled album (e.g., change the scheduled date)
 */
export async function updateScheduledAlbum(
  id: string,
  updates: Partial<Pick<ScheduledAlbum, 'scheduled_date' | 'status'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    // If updating date, check for conflicts
    if (updates.scheduled_date) {
      const existingAlbum = await checkDateAvailability(updates.scheduled_date);
      if (existingAlbum && existingAlbum.id !== id) {
        return {
          success: false,
          error: `Date ${updates.scheduled_date} already has a scheduled album: ${existingAlbum.album_name}`,
        };
      }
    }
    
    const { error } = await supabase
      .from('scheduled_albums')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    
    if (error) {
      console.error('Error updating scheduled album:', error);
      return {
        success: false,
        error: error.message,
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating scheduled album:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Delete a scheduled album (cascade deletes tracks)
 */
export async function deleteScheduledAlbum(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('scheduled_albums')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting scheduled album:', error);
      return {
        success: false,
        error: error.message,
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting scheduled album:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Check if a date already has a scheduled album
 * Returns the album if found, null otherwise
 */
export async function checkDateAvailability(
  date: string
): Promise<ScheduledAlbum | null> {
  try {
    const { data, error } = await supabase
      .from('scheduled_albums')
      .select('*')
      .eq('scheduled_date', date)
      .maybeSingle();
    
    if (error) {
      console.error('Error checking date availability:', error);
      return null;
    }
    
    return data as ScheduledAlbum | null;
  } catch (error) {
    console.error('Error checking date availability:', error);
    return null;
  }
}

/**
 * Get vote counts for all tracks on a scheduled date
 */
export async function getScheduledTrackVotes(
  scheduledDate: string
): Promise<Map<string, number>> {
  try {
    const { data, error } = await supabase.rpc('get_scheduled_track_votes', {
      p_scheduled_date: scheduledDate,
    });
    
    if (error) {
      console.error('Error fetching track votes:', error);
      return new Map();
    }
    
    const voteMap = new Map<string, number>();
    if (data) {
      for (const row of data) {
        voteMap.set(row.track_id, row.vote_count);
      }
    }
    
    return voteMap;
  } catch (error) {
    console.error('Error fetching track votes:', error);
    return new Map();
  }
}

/**
 * Convert iTunes/Spotify album format to schedule data format
 */
export function convertAlbumToScheduleData(album: ITunesAlbum): ScheduleAlbumData {
  return {
    spotifyAlbumId: album.collectionId,
    albumName: album.collectionName,
    artistName: album.artistName,
    artworkUrl: album.artworkUrl600 || album.artworkUrl100,
    trackCount: album.trackCount,
  };
}

/**
 * Convert iTunes/Spotify track format to schedule track data format
 */
export function convertTracksToScheduleData(tracks: ITunesTrack[]): ScheduleTrackData[] {
  return tracks.map((track) => ({
    spotifyTrackId: track.trackId.toString(),
    trackName: track.trackName,
    artistName: track.artistName,
    trackNumber: track.trackNumber,
    durationMs: track.trackTimeMillis,
    artworkUrl: track.artworkUrl600 || track.artworkUrl100,
    previewUrl: track.previewUrl,
    spotifyUrl: track.trackViewUrl,
  }));
}

/**
 * Mark an album as completed (for audit purposes when day passes)
 */
export async function markAlbumCompleted(
  id: string
): Promise<{ success: boolean; error?: string }> {
  return updateScheduledAlbum(id, { status: 'completed' });
}
