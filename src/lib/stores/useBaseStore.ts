
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
          set({ currentUser: user } as Partial<T>);
        },
        
        checkIsAdmin: () => {
          const { currentUser } = get();
          if (!currentUser) {
            console.log(`${name}: checkIsAdmin: No user found`);
            return false;
          }
          
          const isAdmin = Boolean(currentUser.isAdmin);
          console.log(`${name}: Checking isAdmin:`, isAdmin, "Current user:", currentUser);
          return isAdmin;
        },
        
        ...config(set, get),
      } as T),
      {
        name: name,
      }
    )
  );
};
