
import { useAuthStore, toggleAdminMode } from './stores/useAuthStore';
import { useSongStore } from './stores/useSongStore';
import { useVotingStore } from './stores/useVotingStore';

// Create a proxy store that combines all other stores
// This ensures backward compatibility with existing code
export const useSongStore = {
  getState: () => {
    const authState = useAuthStore.getState();
    const songState = useSongStore.getState();
    const votingState = useVotingStore.getState();
    
    return {
      ...authState,
      ...songState,
      ...votingState,
    };
  },
  subscribe: (callback: (state: any) => void) => {
    // Combine subscribers from all stores
    const unsubAuth = useAuthStore.subscribe(callback);
    const unsubSongs = useSongStore.subscribe(callback);
    const unsubVoting = useVotingStore.subscribe(callback);
    
    // Return a function that unsubscribes from all stores
    return () => {
      unsubAuth();
      unsubSongs();
      unsubVoting();
    };
  },
};

// Re-export the toggleAdminMode function for backward compatibility
export { toggleAdminMode };
