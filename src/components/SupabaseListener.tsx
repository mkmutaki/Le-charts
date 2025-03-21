
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/lib/store';
import { User } from '@/lib/types';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const { setCurrentUser } = useAuthStore();

  useEffect(() => {
    // Check for the existing session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('Session found, setting user:', session.user.id);
          
          // Check if the user is an admin using the RPC function
          const { data: isAdmin, error: adminError } = await supabase
            .rpc('is_admin', { user_id: session.user.id });
            
          if (adminError) {
            console.error('Error checking admin status:', adminError);
          }
          
          console.log('User admin status:', isAdmin);
          
          const user: User = {
            id: session.user.id,
            isAdmin: isAdmin || false
          };
          
          setCurrentUser(user);
        } else {
          // No session found, ensure user is null
          console.log('No session found, setting user to null');
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
          toast.success('Signed in successfully!');
          
          // Check if the user is an admin using the RPC function
          const { data: isAdmin, error: adminError } = await supabase
            .rpc('is_admin', { user_id: session.user.id });
            
          if (adminError) {
            console.error('Error checking admin status on sign in:', adminError);
          }
          
          console.log('User admin status (on sign in):', isAdmin);
          
          const user: User = {
            id: session.user.id,
            isAdmin: isAdmin || false
          };
          
          setCurrentUser(user);
        } catch (error) {
          console.error('Error setting user after sign in:', error);
        }
      } else if (event === 'SIGNED_OUT') {
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
