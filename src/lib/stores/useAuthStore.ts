
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { User } from '../types';
import { createBaseStore, BaseState } from './useBaseStore';

interface AuthState extends BaseState {
  checkAdminStatus: () => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = createBaseStore<AuthState>(
  (set, get) => ({
    // Function to check admin status from the database
    checkAdminStatus: async () => {
      const { currentUser } = get();
      
      if (!currentUser) return false;
      
      try {
        const { data, error } = await supabase.rpc('is_admin', {
          user_id: currentUser.id
        });
          
        if (error) {
          console.error('Error checking admin status:', error);
          return false;
        }
        
        return Boolean(data);
      } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
    },
    
    // Add a logout function
    logout: async () => {
      try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          toast.error('Error signing out');
          throw error;
        }
        
        set({ currentUser: null });
        toast.success('Signed out successfully');
      } catch (error) {
        console.error('Error during logout:', error);
        toast.error('Failed to sign out');
      }
    }
  }),
  'auth-store'
);
