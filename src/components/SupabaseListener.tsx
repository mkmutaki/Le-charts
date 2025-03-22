
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const { setCurrentUser } = useAuthStore();

  useEffect(() => {
    // Function to check admin status and update user
    const updateUserWithAdminStatus = async (userId: string) => {
      try {
        // Get admin status from the database
        const { data, error } = await supabase.rpc('is_admin', {
          user_id: userId
        });
        
        if (error) {
          console.error('Error checking admin status:', error);
          return null;
        }
        
        return {
          id: userId,
          isAdmin: Boolean(data)
        };
      } catch (err) {
        console.error('Error in admin status check:', err);
        return null;
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event);
        
        if (session) {
          const user = session.user;
          
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            const updatedUser = await updateUserWithAdminStatus(user.id);
            
            if (updatedUser) {
              console.log("User authenticated with admin status:", updatedUser.isAdmin);
              setCurrentUser(updatedUser);
            } else {
              // Don't clear current user on admin check failure
              console.error("Error checking admin status");
            }
          }
        } else if (event === 'SIGNED_OUT') {
          // Only clear user on explicit sign out
          console.log("User signed out");
          setCurrentUser(null);
        }
      }
    );

    // Check for existing session on mount (only once)
    const checkExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const user = session.user;
        const updatedUser = await updateUserWithAdminStatus(user.id);
        
        if (updatedUser) {
          setCurrentUser(updatedUser);
          console.log("Session found with admin status:", updatedUser.isAdmin);
        }
      }
    };
    
    checkExistingSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentUser]);

  return null;
};
