
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { User } from '../types';
import { createBaseStore, BaseState } from './useBaseStore';
import { useSongStore } from './useSongStore';

interface AuthState extends BaseState {
  checkAdminStatus: () => Promise<boolean>;
}

export const useAuthStore = createBaseStore<AuthState>(
  (set, get) => ({
    // Function to check admin status from the database
    checkAdminStatus: async () => {
      const { currentUser } = get();
      
      if (!currentUser) return false;
      
      try {
        console.log("Checking admin status for user:", currentUser.id);
        
        // Get admin status from the database
        const { data, error } = await supabase.rpc('is_admin', {
          user_id: currentUser.id
        });
          
        console.log("is_admin RPC response:", { data, error });
        
        if (error) {
          console.error('Error checking admin status:', error);
          return false;
        }
        
        const isAdmin = Boolean(data);
        console.log("Admin status from DB:", isAdmin);
        
        // Only update the user object if the admin status has changed
        if (currentUser.isAdmin !== isAdmin) {
          console.log("Admin status changed, updating user to:", isAdmin);
          const updatedUser = { ...currentUser, isAdmin };
          set({ currentUser: updatedUser } as Partial<AuthState>);
        }
        
        return isAdmin;
      } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
    },
  }),
  'auth-store'
);
