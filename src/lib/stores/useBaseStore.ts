
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
        currentUser: null, // Default to null, not dummy user
        isLoading: false,
        
        setCurrentUser: (user) => {
          set({ currentUser: user } as Partial<T>);
        },
        
        checkIsAdmin: () => {
          const { currentUser } = get();
          return currentUser?.isAdmin || false;
        },
        
        ...config(set, get),
      } as T),
      {
        name: name,
      }
    )
  );
};
