
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/lib/store';

export const SupabaseListener = () => {
  const { setCurrentUser } = useAuthStore();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          const user = session.user;
          
          try {
            // Get admin status from the database
            const { data, error } = await supabase.rpc('is_admin', {
              user_id: user.id
            });
            
            if (error) {
              console.error('Error checking admin status:', error);
            }
            
            // Update the user in the store
            setCurrentUser({
              id: user.id,
              isAdmin: data || false
            });
          } catch (error) {
            console.error('Error in auth state change listener:', error);
            // Set basic user without admin privileges on error
            setCurrentUser({
              id: user.id,
              isAdmin: false
            });
          }
        } else if (event === 'SIGNED_OUT') {
          // No session means the user is signed out
          setCurrentUser(null);
        }
      }
    );

    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const user = session.user;
          
          try {
            // Get admin status from the database
            const { data, error } = await supabase.rpc('is_admin', {
              user_id: user.id
            });
            
            // Update the user in the store
            setCurrentUser({
              id: user.id,
              isAdmin: data || false
            });
          } catch (error) {
            console.error('Error checking admin status:', error);
            // Set basic user without admin privileges on error
            setCurrentUser({
              id: user.id,
              isAdmin: false
            });
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
    };
    
    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentUser]);

  return null;
};
