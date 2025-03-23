
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
  
  console.log("Toggle admin mode - Current user before toggle:", currentUser);
  
  if (currentUser?.isAdmin) {
    setCurrentUser(dummyUser);
    console.log("Switched to regular user mode", dummyUser);
    toast.info('Switched to regular user mode');
  } else {
    setCurrentUser(dummyAdmin);
    console.log("Switched to admin mode", dummyAdmin);
    toast.info('Switched to admin mode');
  }
  
  // Log the updated state to confirm
  setTimeout(() => {
    const { currentUser: updatedUser, checkIsAdmin } = useAuthStore.getState();
    const isAdminNow = checkIsAdmin();
    console.log("User after toggle:", updatedUser, "Is admin now:", isAdminNow);
  }, 100);
};
