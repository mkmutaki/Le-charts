
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
  
  // Update both stores with the same user object
  setCurrentUser(newUser);
  songStore.setCurrentUser(newUser);
  
  toast.info(`Switched to ${newUser.isAdmin ? 'admin' : 'regular user'} mode`);
};
