import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/lib/store';

export const SupabaseListener = () => {
  const { setCurrentUser } = useAuthStore();

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
            
            // Update the user in the store
            setCurrentUser({
              id: user.id,
              isAdmin: data || false
            });
            
            console.log("Auth state changed - User set:", {
              id: user.id,
              isAdmin: data || false
            });
          } else {
            // No session means the user is signed out
            // For development, we'll keep the dummy user instead of setting to null
            // setCurrentUser(null);
            console.log("Auth state changed - No session, but keeping dummy user for development");
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
          
          // Update the user in the store
          setCurrentUser({
            id: user.id,
            isAdmin: data || false
          });
          
          console.log("Session found - User set:", {
            id: user.id,
            isAdmin: data || false
          });
        } else {
          // Keep using the dummy user from the store for development
          console.log("No session found, but keeping dummy user for development");
        }
      } catch (error) {
        console.error("Error in session check:", error);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentUser]);

  return null;
};
