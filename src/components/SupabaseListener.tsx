
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
      }
    );

    // Check for existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
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
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentUser]);

  return null;
};
