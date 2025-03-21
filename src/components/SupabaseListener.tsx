
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/lib/store';
import { User } from '@/lib/types';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const { setCurrentUser } = useAuthStore();
  const hasInitialized = useRef(false);
  const previousAuthId = useRef<string | null>(null);
  const isCheckingAdmin = useRef(false);

  // Function to check admin status
  const checkAdminStatus = async (userId: string): Promise<boolean> => {
    if (!userId || isCheckingAdmin.current) return false;
    
    isCheckingAdmin.current = true;
    try {
      console.log('Checking admin status for user:', userId);
      const { data, error } = await supabase
        .from('user_roles')
        .select('is_admin')
        .eq('user_id', userId)
        .single();
        
      isCheckingAdmin.current = false;
      
      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
      
      const isAdmin = data?.is_admin || false;
      console.log('Admin status result:', isAdmin);
      return isAdmin;
    } catch (error) {
      console.error('Exception checking admin status:', error);
      isCheckingAdmin.current = false;
      return false;
    }
  };

  useEffect(() => {
    // Only initialize once
    if (hasInitialized.current) return;
    
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth session...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('Session found, setting user:', session.user.id);
          previousAuthId.current = session.user.id;
          
          const isAdmin = await checkAdminStatus(session.user.id);
          
          const user: User = {
            id: session.user.id,
            isAdmin: isAdmin
          };
          
          setCurrentUser(user);
        } else {
          console.log('No session found, setting user to null');
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setCurrentUser(null);
      } finally {
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
          // Only show toast once per sign-in
          toast.success('Signed in successfully!');
          
          const isAdmin = await checkAdminStatus(session.user.id);
          
          const user: User = {
            id: session.user.id,
            isAdmin: isAdmin
          };
          
          setCurrentUser(user);
        } catch (error) {
          console.error('Error setting user after sign in:', error);
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
