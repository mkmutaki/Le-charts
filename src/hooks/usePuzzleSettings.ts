
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PuzzleSettings {
  id: string;
  current_album_cover_url: string;
  album_title?: string;
  album_artist?: string;
}

export const usePuzzleSettings = () => {
  const [settings, setSettings] = useState<PuzzleSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('puzzle_settings')
        .select('*')
        .single();

      if (error) {
        console.error('Error fetching puzzle settings:', error);
        return;
      }

      setSettings(data);
    } catch (error) {
      console.error('Error fetching puzzle settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAlbumCover = async (
    imageUrl: string, 
    albumTitle?: string, 
    albumArtist?: string,
    showToast: boolean = true
  ) => {
    if (!settings) {
      // If settings don't exist yet, try to fetch them first
      await fetchSettings();
    }

    try {
      // Use upsert to handle case where settings row might not exist
      const { data: existingSettings, error: fetchError } = await supabase
        .from('puzzle_settings')
        .select('id')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is fine
        console.error('Error checking puzzle settings:', fetchError);
        if (showToast) toast.error('Failed to update puzzle game settings');
        return false;
      }

      if (existingSettings) {
        // Update existing row
        const { error } = await supabase
          .from('puzzle_settings')
          .update({
            current_album_cover_url: imageUrl,
            album_title: albumTitle,
            album_artist: albumArtist,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSettings.id);

        if (error) {
          console.error('Error updating puzzle settings:', error);
          if (showToast) toast.error('Failed to update puzzle game settings');
          return false;
        }
      } else {
        // Insert new row (should rarely happen as we seed the table)
        const { error } = await supabase
          .from('puzzle_settings')
          .insert({
            current_album_cover_url: imageUrl,
            album_title: albumTitle,
            album_artist: albumArtist,
          });

        if (error) {
          console.error('Error inserting puzzle settings:', error);
          if (showToast) toast.error('Failed to update puzzle game settings');
          return false;
        }
      }

      await fetchSettings();
      if (showToast) toast.success('Puzzle game settings updated');
      return true;
    } catch (error) {
      console.error('Error updating puzzle settings:', error);
      if (showToast) toast.error('Failed to update puzzle game settings');
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    updateAlbumCover,
    refetch: fetchSettings
  };
};

/**
 * Standalone function to update puzzle settings without hook initialization.
 * Use this when you need to update puzzle settings from outside a component
 * that uses the usePuzzleSettings hook (e.g., from AlbumSearchModal).
 */
export const updatePuzzleSettingsFromAlbum = async (
  coverUrl: string,
  albumName: string,
  artistName: string
): Promise<boolean> => {
  try {
    // First, get the existing settings row ID
    const { data: existingSettings, error: fetchError } = await supabase
      .from('puzzle_settings')
      .select('id')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking puzzle settings:', fetchError);
      return false;
    }

    if (existingSettings) {
      // Update existing row
      const { error } = await supabase
        .from('puzzle_settings')
        .update({
          current_album_cover_url: coverUrl,
          album_title: albumName,
          album_artist: artistName,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSettings.id);

      if (error) {
        console.error('Error updating puzzle settings from album:', error);
        return false;
      }
    } else {
      // Insert new row
      const { error } = await supabase
        .from('puzzle_settings')
        .insert({
          current_album_cover_url: coverUrl,
          album_title: albumName,
          album_artist: artistName,
        });

      if (error) {
        console.error('Error inserting puzzle settings from album:', error);
        return false;
      }
    }

    console.log('Puzzle settings updated successfully from album upload');
    return true;
  } catch (error) {
    console.error('Error updating puzzle settings from album:', error);
    return false;
  }
};

/**
 * Update puzzle settings from a scheduled album.
 * Called when the app loads today's scheduled album or when date changes.
 */
export const updatePuzzleSettingsFromScheduledAlbum = async (
  coverUrl: string,
  albumName: string,
  artistName: string
): Promise<boolean> => {
  // Reuse the same logic as regular album upload
  return updatePuzzleSettingsFromAlbum(coverUrl, albumName, artistName);
};
