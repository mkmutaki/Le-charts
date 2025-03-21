
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/lib/store';
import { User } from '@/lib/types';

export const SupabaseListener = () => {
  const { setCurrentUser } = useAuthStore();

  useEffect(() => {
    // Check for the existing session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Check if the user is an admin
          const { data, error } = await supabase
            .from('user_roles')
            .select('is_admin')
            .eq('user_id', session.user.id)
            .single();
            
          const isAdmin = data?.is_admin || false;
          
          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching admin status:', error);
          }
          
          const user: User = {
            id: session.user.id,
            isAdmin
          };
          
          setCurrentUser(user);
        } else {
          // No session found, ensure user is null
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setCurrentUser(null);
      }
    };
    
    initializeAuth();
    
    // Listen for authentication changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          // Check if the user is an admin
          const { data, error } = await supabase
            .from('user_roles')
            .select('is_admin')
            .eq('user_id', session.user.id)
            .single();
            
          const isAdmin = data?.is_admin || false;
          
          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching admin status on sign in:', error);
          }
          
          const user: User = {
            id: session.user.id,
            isAdmin
          };
          
          setCurrentUser(user);
        } catch (error) {
          console.error('Error setting user after sign in:', error);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentUser]);
  
  return null;
};
