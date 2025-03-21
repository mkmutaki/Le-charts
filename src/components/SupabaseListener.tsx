
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/lib/store';
import { User } from '@/lib/types';

export const SupabaseListener = () => {
  const { setCurrentUser } = useAuthStore();

  useEffect(() => {
    // Check for the existing session
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Check if the user is an admin
        const { data, error } = await supabase
          .from('user_roles')
          .select('is_admin')
          .eq('user_id', session.user.id)
          .single();
          
        const isAdmin = data?.is_admin || false;
        
        const user: User = {
          id: session.user.id,
          isAdmin
        };
        
        setCurrentUser(user);
      }
    };
    
    initializeAuth();
    
    // Listen for authentication changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Check if the user is an admin
        const { data, error } = await supabase
          .from('user_roles')
          .select('is_admin')
          .eq('user_id', session.user.id)
          .single();
          
        const isAdmin = data?.is_admin || false;
        
        const user: User = {
          id: session.user.id,
          isAdmin
        };
        
        setCurrentUser(user);
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
