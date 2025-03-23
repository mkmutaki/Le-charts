import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/lib/store';
import { dummyUser, dummyAdmin } from '@/lib/stores/useBaseStore';

export const SupabaseListener = () => {
  const { setCurrentUser, currentUser } = useAuthStore();

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
            // For development, we'll keep the dummy user instead of setting to null
            // We don't need to set it here as it's already the default in the store
            console.log("Auth state changed - No session, keeping dummy user for development");
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
          console.log("No session found, keeping dummy user from store for development");
          // We don't need to explicitly set it here as it's already the default
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
  }, [setCurrentUser, currentUser]);

  return null;
};
