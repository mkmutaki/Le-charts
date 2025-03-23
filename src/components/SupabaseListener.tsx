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
            
            // Update the user in the store
            setCurrentUser({
              id: user.id,
              isAdmin: data || false
            });
          } else {
            // No session means the user is signed out
            setCurrentUser(null);
          }
        } catch (error) {
          console.error("Error handling auth state change:", error);
          // Ensure we don't lose state on error
        }
      }
    );

    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const user = session.user;
          
          // Get admin status from the database
          const { data, error } = await supabase.rpc('is_admin', {
            user_id: user.id
          });
          
          // Update the user in the store
          setCurrentUser({
            id: user.id,
            isAdmin: data || false
          });
        }
      } catch (error) {
        console.error("Error checking session:", error);
        // Don't update state on error, keep using dummy user
      }
    };

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentUser]);

  return null;
};
