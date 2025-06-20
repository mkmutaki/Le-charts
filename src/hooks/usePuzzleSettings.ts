
import { useState, useEffect } from 'react';
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

  const fetchSettings = async () => {
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
  };

  const updateAlbumCover = async (
    imageUrl: string, 
    albumTitle?: string, 
    albumArtist?: string
  ) => {
    if (!settings) return;

    try {
      const { error } = await supabase
        .from('puzzle_settings')
        .update({
          current_album_cover_url: imageUrl,
          album_title: albumTitle,
          album_artist: albumArtist,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings.id);

      if (error) {
        console.error('Error updating puzzle settings:', error);
        toast.error('Failed to update album cover');
        return false;
      }

      await fetchSettings();
      toast.success('Album cover updated successfully');
      return true;
    } catch (error) {
      console.error('Error updating puzzle settings:', error);
      toast.error('Failed to update album cover');
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    updateAlbumCover,
    refetch: fetchSettings
  };
};
