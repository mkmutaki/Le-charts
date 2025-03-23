
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/lib/store';

export const SupabaseListener = () => {
  const { setCurrentUser } = useAuthStore();

  useEffect(() => {
    console.log('Setting up Supabase auth listener');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session ? 'session exists' : 'no session');
        
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
            console.log('Setting current user with admin status:', data);
            setCurrentUser({
              id: user.id,
              isAdmin: data || false
            });
          } catch (err) {
            console.error('Error in auth state change handler:', err);
            // Set user without admin privileges if there was an error
            setCurrentUser({
              id: user.id,
              isAdmin: false
            });
          }
        } else {
          // No session means the user is signed out
          console.log('No session, setting current user to null');
          setCurrentUser(null);
        }
      }
    );

    // Check for existing session on mount
    const checkSession = async () => {
      try {
        console.log('Checking for existing session');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log('Existing session found');
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
            console.log('Setting current user with admin status:', data);
            setCurrentUser({
              id: user.id,
              isAdmin: data || false
            });
          } catch (err) {
            console.error('Error checking admin status:', err);
            // Set user without admin privileges if there was an error
            setCurrentUser({
              id: user.id,
              isAdmin: false
            });
          }
        } else {
          console.log('No existing session found');
        }
      } catch (err) {
        console.error('Error checking session:', err);
      }
    };

    checkSession();

    return () => {
      console.log('Cleaning up Supabase auth listener');
      subscription.unsubscribe();
    };
  }, [setCurrentUser]);

  return null;
};
