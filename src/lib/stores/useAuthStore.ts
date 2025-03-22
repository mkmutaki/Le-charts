
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
        // Check if we already have admin status cached
        if (typeof currentUser.isAdmin === 'boolean') {
          return currentUser.isAdmin;
        }
        
        const { data, error } = await supabase.rpc('is_admin', {
          user_id: currentUser.id
        });
          
        if (error) {
          console.error('Error checking admin status:', error);
          toast.error('Error verifying admin permissions');
          return false;
        }
        
        const isAdmin = Boolean(data);
        
        // Update the user with the admin status - use functional update to avoid 
        // issues if the state has been updated elsewhere
        set((state) => ({ 
          currentUser: state.currentUser ? {
            ...state.currentUser,
            isAdmin
          } : null
        }));
        
        return isAdmin;
      } catch (error) {
        console.error('Error checking admin status:', error);
        toast.error('Error verifying admin permissions');
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
