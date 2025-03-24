
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { User } from '../types';
import { createBaseStore, BaseState, dummyUser, dummyAdmin } from './useBaseStore';
import { useSongStore } from './useSongStore';

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
        const { data, error } = await supabase.rpc('is_admin', {
          user_id: currentUser.id
        });
          
        if (error) {
          console.error('Error checking admin status:', error);
          return false;
        }
        
        return data || false;
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
  const songStore = useSongStore.getState();
  
  console.log("Toggle admin mode - Current user before toggle:", currentUser);
  
  // Create the new user object based on current admin status
  const newUser = currentUser?.isAdmin ? dummyUser : dummyAdmin;
  
  // Update both stores with the same user object
  setCurrentUser(newUser);
  if (songStore.setCurrentUser) {
    songStore.setCurrentUser(newUser);
  }
  
  console.log(`Switched to ${newUser.isAdmin ? 'admin' : 'regular user'} mode`, newUser);
  toast.info(`Switched to ${newUser.isAdmin ? 'admin' : 'regular user'} mode`);
  
  // Log the updated state to confirm
  setTimeout(() => {
    const { currentUser: updatedUser, checkIsAdmin } = useAuthStore.getState();
    const isAdminNow = checkIsAdmin();
    const songStoreAdmin = useSongStore.getState().checkIsAdmin();
    console.log("User after toggle:", updatedUser, "Is admin now:", isAdminNow);
    console.log("SongStore admin status:", songStoreAdmin);
  }, 100);
};
