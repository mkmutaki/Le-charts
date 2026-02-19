
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getAlbumForDate } from '@/lib/services/scheduledAlbumService';
import { getLocalDateString } from '@/lib/dateUtils';

interface PuzzleSettings {
  current_album_cover_url: string;
  album_title?: string;
  album_artist?: string;
}

export const usePuzzleSettings = () => {
  const [settings, setSettings] = useState<PuzzleSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async (date?: string) => {
    try {
      const targetDate = date || getLocalDateString();
      const albumData = await getAlbumForDate(targetDate);

      if (albumData?.album) {
        setSettings({
          current_album_cover_url: albumData.album.artwork_url,
          album_title: albumData.album.album_name,
          album_artist: albumData.album.artist_name,
        });
      } else {
        setSettings(null);
      }
    } catch (error) {
      console.error('Error fetching puzzle settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, refetch: fetchSettings };
};