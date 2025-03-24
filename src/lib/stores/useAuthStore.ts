
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
    // Function to check admin status from the database
    checkAdminStatus: async () => {
      const { currentUser } = get();
      
      if (!currentUser) return false;
      
      try {
        // Using a flag to track if we're already updating to prevent loops
        const { data, error } = await supabase.rpc('is_admin', {
          user_id: currentUser.id
        });
          
        if (error) {
          console.error('Error checking admin status:', error);
          return false;
        }
        
        // Only update the user object if the admin status has changed
        if (currentUser.isAdmin !== data) {
          set({ 
            currentUser: { ...currentUser, isAdmin: data } 
          } as Partial<AuthState>);
        }
        
        console.log('Admin status checked from database:', data);
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
  
  // If no user is logged in, use dummy users for development
  if (!currentUser) {
    const newUser = dummyUser;
    setCurrentUser(newUser);
    songStore.setCurrentUser(newUser);
    toast.info(`Set to regular user mode`);
    return;
  }
  
  // Toggle admin status based on current state
  const newUser: User = {
    ...currentUser,
    isAdmin: !currentUser.isAdmin
  };
  
  console.log("New user object created:", newUser);
  
  // Update both stores with the same user object
  setCurrentUser(newUser);
  songStore.setCurrentUser(newUser);
  
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
