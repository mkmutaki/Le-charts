
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/lib/store';
import { User } from '@/lib/types';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const { setCurrentUser } = useAuthStore();
  const hasInitialized = useRef(false);
  const previousAuthId = useRef<string | null>(null);

  useEffect(() => {
    // Check for the existing session
    const initializeAuth = async () => {
      if (hasInitialized.current) return;
      
      try {
        console.log('Initializing auth session...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('Session found, setting user:', session.user.id);
          previousAuthId.current = session.user.id;
          
          // Check if the user is an admin by querying the user_roles table directly
          const { data, error } = await supabase
            .from('user_roles')
            .select('is_admin')
            .eq('user_id', session.user.id)
            .single();
            
          if (error) {
            console.error('Error checking admin status:', error);
            // Continue with non-admin user rather than failing
          }
          
          const isAdmin = data?.is_admin || false;
          console.log('User admin status:', isAdmin, 'based on data:', data);
          
          const user: User = {
            id: session.user.id,
            isAdmin: isAdmin
          };
          
          setCurrentUser(user);
        } else {
          // No session found, ensure user is null
          console.log('No session found, setting user to null');
          setCurrentUser(null);
        }
        
        hasInitialized.current = true;
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Set current user to null on error to prevent infinite loading
        setCurrentUser(null);
        hasInitialized.current = true;
      }
    };
    
    initializeAuth();
    
    // Listen for authentication changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' && session?.user && previousAuthId.current !== session.user.id) {
        previousAuthId.current = session.user.id;
        
        try {
          // Check if the user is an admin by querying the user_roles table
          const { data, error } = await supabase
            .from('user_roles')
            .select('is_admin')
            .eq('user_id', session.user.id)
            .single();
            
          if (error) {
            console.error('Error checking admin status on sign in:', error);
            // Continue with non-admin user rather than failing
          }
          
          const isAdmin = data?.is_admin || false;
          console.log('User admin status on sign in:', isAdmin, 'based on data:', data);
          
          const user: User = {
            id: session.user.id,
            isAdmin: isAdmin
          };
          
          setCurrentUser(user);
          toast.success('Signed in successfully!');
        } catch (error) {
          console.error('Error setting user after sign in:', error);
          // Set a basic non-admin user on error to prevent white screen
          if (session?.user) {
            setCurrentUser({
              id: session.user.id,
              isAdmin: false
            });
          }
        }
      } else if (event === 'SIGNED_OUT') {
        previousAuthId.current = null;
        toast.info('Signed out successfully');
        setCurrentUser(null);
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentUser]);
  
  return null;
};
