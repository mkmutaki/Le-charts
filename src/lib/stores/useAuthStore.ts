
import { toast } from 'sonner';
import { createBaseStore, BaseState } from './useBaseStore';
import { getAdminStatus } from '../services/adminService';

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

        const { isAdmin, error } = await getAdminStatus(currentUser.id);

        if (error) {
          console.error('Error checking admin status:', error);
          toast.error('Error verifying permissions');
          return false;
        }

        console.log("Admin status from database:", isAdmin);
        
        // Update the user object if the admin status has changed
        if (currentUser.isAdmin !== isAdmin) {
          console.log("Admin status changed, updating user");
          set({ 
            currentUser: { ...currentUser, isAdmin } 
          } as Partial<AuthState>);
        }
        
        return isAdmin;
      } catch (error) {
        console.error('Error checking admin status:', error);
        toast.error('Error verifying permissions');
        return false;
      }
    },
  }),
  'auth-store'
);
