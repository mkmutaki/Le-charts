
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { User } from '../types';
import { createBaseStore, BaseState, dummyUser, dummyAdmin } from './useBaseStore';

interface AuthState extends BaseState {
  checkAdminStatus: () => Promise<boolean>;
}

export const useAuthStore = createBaseStore<AuthState>(
  (set, get) => ({
    // New function to check admin status from the database
    checkAdminStatus: async () => {
      const { currentUser } = get();
      
      if (!currentUser) return false;
      
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('is_admin')
          .eq('user_id', currentUser.id)
          .single();
          
        if (error) {
          console.error('Error checking admin status:', error);
          return false;
        }
        
        return data?.is_admin || false;
      } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
    },
  }),
  'auth-store'
);

// For development testing: Function to toggle between admin and regular user
export const toggleAdminMode = () => {
  const { currentUser, setCurrentUser } = useAuthStore.getState();
  
  if (currentUser?.isAdmin) {
    setCurrentUser(dummyUser);
    toast.info('Switched to regular user mode');
  } else {
    setCurrentUser(dummyAdmin);
    toast.info('Switched to admin mode');
  }
};
