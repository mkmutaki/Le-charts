
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, useSongStore } from '@/lib/store';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const { setCurrentUser, currentUser, checkAdminStatus } = useAuthStore();
  const songStore = useSongStore();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change event:", event);
        
        try {
          if (session) {
            const user = session.user;
            
            // Get admin status from the database
            const { data: isAdmin, error } = await supabase.rpc('is_admin', {
              user_id: user.id
            });
            
            if (error) {
              console.error("Error checking admin status:", error);
              toast.error("Error checking permissions");
            }
            
            const newUserState = {
              id: user.id,
              isAdmin: isAdmin || false
            };
            
            console.log(`Auth state changed (${event}) - Setting user with admin status:`, isAdmin);
            
            // Update the user in both stores
            setCurrentUser(newUserState);
            songStore.setCurrentUser(newUserState);
            
            if (event === 'SIGNED_IN') {
              toast.success('Signed in successfully');
            }
          } else if (event === 'SIGNED_OUT') {
            // Clear the user on sign out
            setCurrentUser(null);
            songStore.setCurrentUser(null);
            toast.info('Signed out');
          }
        } catch (error) {
          console.error("Error in auth state change handler:", error);
          toast.error("An error occurred while processing your authentication");
        }
      }
    );

    // Check for existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      try {
        if (session) {
          const user = session.user;
          
          // Get admin status from the database
          const { data: isAdmin, error } = await supabase.rpc('is_admin', {
            user_id: user.id
          });
          
          if (error) {
            console.error("Error checking admin status:", error);
          }
          
          const newUserState = {
            id: user.id,
            isAdmin: isAdmin || false
          };
          
          console.log("Session found - Setting user with admin status:", isAdmin);
          
          // Update the user in both stores
          setCurrentUser(newUserState);
          songStore.setCurrentUser(newUserState);
        } else {
          console.log("No active session found");
        }
      } catch (error) {
        console.error("Error in session check:", error);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentUser, songStore]);

  return null;
};
