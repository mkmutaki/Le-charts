
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
        
        // DEBUGGING: Log the user ID being sent to the RPC
        console.log("RPC is_admin being called with user_id:", currentUser.id);
        
        // Using a flag to track if we're already updating to prevent loops
        const { data, error } = await supabase.rpc('is_admin', {
          user_id: currentUser.id
        });
          
        // DEBUGGING: Log the raw response from the RPC
        console.log("RPC is_admin raw response:", { data, error });
        
        if (error) {
          console.error('Error checking admin status:', error);
          return false;
        }
        
        const isAdmin = Boolean(data);
        
        // DEBUGGING: Log the processed boolean result
        console.log("Admin status after processing:", isAdmin);
        
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
