
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const { setCurrentUser } = useAuthStore();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event);
        
        if (session) {
          const user = session.user;
          
          try {
            // Get admin status from the database
            const { data, error } = await supabase.rpc('is_admin', {
              user_id: user.id
            });
            
            if (error) {
              console.error('Error checking admin status:', error);
              toast.error('Error checking admin status');
              setCurrentUser(null);
              return;
            }
            
            const isAdmin = Boolean(data);
            
            // Update the user in the store
            setCurrentUser({
              id: user.id,
              isAdmin
            });
            
            console.log("User authenticated with admin status:", isAdmin);
            
            if (event === 'SIGNED_IN') {
              // We'll let the Login component handle navigation and any messaging
              // rather than signing out non-admin users here
              toast.success('Authentication successful');
            }
          } catch (err) {
            console.error('Error in auth listener:', err);
            setCurrentUser(null);
          }
        } else {
          // No session means the user is signed out
          console.log("User signed out");
          setCurrentUser(null);
        }
      }
    );

    // Check for existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const user = session.user;
        
        try {
          // Get admin status from the database
          const { data, error } = await supabase.rpc('is_admin', {
            user_id: user.id
          });
          
          if (error) {
            console.error('Error checking admin status:', error);
            setCurrentUser(null);
            return;
          }
          
          const isAdmin = Boolean(data);
          
          // Update the user in the store
          setCurrentUser({
            id: user.id,
            isAdmin
          });
          
          console.log("Session found with admin status:", isAdmin);
        } catch (err) {
          console.error('Error checking session:', err);
          setCurrentUser(null);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentUser]);

  return null;
};
