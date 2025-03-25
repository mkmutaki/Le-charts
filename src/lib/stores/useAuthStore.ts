
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
        
        // Call the is_admin RPC function with user ID as text
        const { data, error } = await supabase.rpc('is_admin', {
          user_id: currentUser.id
        });
          
        // Log the response for debugging
        console.log("RPC is_admin response:", { data, error });
        
        if (error) {
          console.error('Error checking admin status:', error);
          return false;
        }
        
        const isAdmin = Boolean(data);
        console.log("Admin status determined:", isAdmin);
        
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
