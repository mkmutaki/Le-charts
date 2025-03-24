
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

// Create dummy users for development
export const dummyUser: User = {
  id: 'user-1',
  isAdmin: false  // Set to false for non-admin mode
};

export const dummyAdmin: User = {
  id: 'admin-1',
  isAdmin: true
};

// Base state interface with shared properties
export interface BaseState {
  currentUser: User | null;
  isLoading: boolean;
  setCurrentUser: (user: User | null) => void;
  checkIsAdmin: () => boolean;
}

// Create a base store that can be used by other stores
export const createBaseStore = <T extends BaseState>(
  config: (set: any, get: any) => Omit<T, keyof BaseState>,
  name: string
) => {
  return create<T>()(
    persist(
      (set, get) => ({
        currentUser: null, // Start with no user instead of dummy user
        isLoading: false,
        
        setCurrentUser: (user) => {
          console.log(`Setting current user in ${name}:`, user);
          // Ensure we don't trigger unnecessary rerenders by setting to the same object
          const currentUser = get().currentUser;
          if (JSON.stringify(currentUser) === JSON.stringify(user)) {
            console.log("User is the same, not updating", name);
            return;
          }
          
          set({ currentUser: user } as Partial<T>);
        },
        
        checkIsAdmin: () => {
          const { currentUser } = get();
          if (!currentUser) {
            return false;
          }
          
          // Simply return the isAdmin property without any API calls
          return Boolean(currentUser.isAdmin);
        },
        
        ...config(set, get),
      } as T),
      {
        name: name,
      }
    )
  );
};
