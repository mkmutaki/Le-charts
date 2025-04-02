
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';

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
        currentUser: null,
        isLoading: false,
        
        setCurrentUser: (user) => {
          // Ensure we don't trigger unnecessary rerenders
          const currentUser = get().currentUser;
          if (JSON.stringify(currentUser) === JSON.stringify(user)) {
            return;
          }
          
          set({ currentUser: user } as Partial<T>);
        },
        
        // Simple in-memory check for UI purposes only
        // Critical operations should use checkAdminStatus() instead
        checkIsAdmin: () => {
          const { currentUser } = get();
          return Boolean(currentUser?.isAdmin);
        },
        
        ...config(set, get),
      } as T),
      {
        name: name,
      }
    )
  );
};
