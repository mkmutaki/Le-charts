
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
        
        // Using a flag to track if we're already updating to prevent loops
        const { data, error } = await supabase.rpc('is_admin', {
          user_id: currentUser.id
        });
          
        if (error) {
          console.error('Error checking admin status:', error);
          return false;
        }
        
        const isAdmin = Boolean(data);
        
        // Only update the user object if the admin status has changed
        if (currentUser.isAdmin !== isAdmin) {
          console.log("Admin status changed, updating user", isAdmin);
          set({ 
            currentUser: { ...currentUser, isAdmin } 
          } as Partial<AuthState>);
        } else {
          console.log("Admin status unchanged:", isAdmin);
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

// Remove the toggleAdminMode function as it's no longer needed
