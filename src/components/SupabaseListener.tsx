
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSongStore } from '@/lib/store';

export const SupabaseListener = () => {
  const { fetchSongs } = useSongStore();
  
  useEffect(() => {
    // Set up realtime subscription to refresh data when changes occur
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'LeSongs'
        },
        () => {
          // Refresh songs when any change happens
          fetchSongs();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'song_votes'
        },
        () => {
          // Refresh songs when votes change
          fetchSongs();
        }
      )
      .subscribe();
      
    return () => {
      // Clean up subscription
      supabase.removeChannel(channel);
    };
  }, [fetchSongs]);
  
  // This is a utility component that doesn't render anything
  return null;
};
