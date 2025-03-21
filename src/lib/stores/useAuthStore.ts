
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { User } from '../types';
import { createBaseStore, BaseState } from './useBaseStore';

interface AuthState extends BaseState {
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  checkAdminStatus: () => Promise<boolean>;
  checkIsAdmin: () => boolean;
  isLoading: boolean;
}

export const useAuthStore = createBaseStore<AuthState>(
  (set, get) => ({
    currentUser: null,
    isLoading: false,
    
    // Login function
    login: async (email: string, password: string) => {
      set({ isLoading: true });
      
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (error) {
          toast.error(error.message);
          set({ isLoading: false });
          return { error: error.message };
        }
        
        if (!data.user) {
          set({ isLoading: false });
          return { error: 'No user returned from login' };
        }
        
        // Admin status will be set by the auth listener
        set({ isLoading: false });
        return { error: null };
      } catch (error) {
        console.error('Login error:', error);
        set({ isLoading: false });
        return { error: 'An unexpected error occurred' };
      }
    },
    
    // Logout function
    logout: async () => {
      set({ isLoading: true });
      
      try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          toast.error(error.message);
        } else {
          set({ currentUser: null });
          toast.info('Logged out successfully');
        }
      } catch (error) {
        console.error('Logout error:', error);
        toast.error('Error during logout');
      } finally {
        set({ isLoading: false });
      }
    },
    
    // Function to check admin status from the database
    checkAdminStatus: async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) return false;
        
        // Query the user_roles table directly
        const { data, error } = await supabase
          .from('user_roles')
          .select('is_admin')
          .eq('user_id', authData.user.id)
          .single();
          
        if (error) {
          console.error('Error checking admin status:', error);
          return false;
        }
        
        console.log('Admin status from database:', data?.is_admin);
        return data?.is_admin || false;
      } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
    },
    
    // Synchronous function to check admin status from store
    checkIsAdmin: () => {
      const { currentUser } = get();
      const isAdmin = currentUser?.isAdmin || false;
      console.log('Check isAdmin called, returning:', isAdmin, 'for user:', currentUser);
      return isAdmin;
    }
  }),
  'auth-store'
);

// For development testing only: Function to toggle between admin and regular user
export const toggleAdminMode = () => {
  const { currentUser, setCurrentUser } = useAuthStore.getState();
  
  if (!currentUser) return;
  
  setCurrentUser({
    ...currentUser,
    isAdmin: !currentUser.isAdmin
  });
  
  toast.info(currentUser.isAdmin ? 'Switched to regular user mode' : 'Switched to admin mode');
};
