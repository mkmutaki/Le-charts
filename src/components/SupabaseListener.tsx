import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, useSongStore } from '@/lib/store';

export const SupabaseListener = () => {
  const { setCurrentUser, currentUser } = useAuthStore();
  const songStore = useSongStore();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (session) {
            const user = session.user;
            
            // Get admin status from the database
            const { data, error } = await supabase.rpc('is_admin', {
              user_id: user.id
            });
            
            if (error) {
              console.error("Error checking admin status:", error);
            }
            
            const newUserState = {
              id: user.id,
              isAdmin: data || false
            };
            
            // Update the user in both stores
            setCurrentUser(newUserState);
            songStore.setCurrentUser(newUserState);
            
            console.log("Auth state changed - User set:", newUserState);
          } else {
            // For development, we'll keep the current user instead of resetting
            console.log("Auth state changed - No session, keeping current user for development");
          }
        } catch (error) {
          console.error("Error in auth state change handler:", error);
        }
      }
    );

    // Check for existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        if (session) {
          const user = session.user;
          
          // Get admin status from the database
          const { data, error } = await supabase.rpc('is_admin', {
            user_id: user.id
          });
          
          if (error) {
            console.error("Error checking admin status:", error);
          }
          
          const newUserState = {
            id: user.id,
            isAdmin: data || false
          };
          
          // Update the user in both stores
          setCurrentUser(newUserState);
          songStore.setCurrentUser(newUserState);
          
          console.log("Session found - User set:", newUserState);
        } else {
          // Keep the current user from the store for development
          console.log("No session found, keeping current user from store for development");
        }
      } catch (error) {
        console.error("Error in session check:", error);
      }
    });

    // Log the current user to help with debugging
    console.log("Current user in SupabaseListener at initialization:", currentUser);

    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentUser, currentUser, songStore]);

  return null;
};
