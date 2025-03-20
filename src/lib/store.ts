
// Import store hooks from their modules
import { useAuthStore as authStore, toggleAdminMode } from './stores/useAuthStore';
import { useSongStore as songStore } from './stores/useSongStore';
import { useVotingStore as voteStore } from './stores/useVotingStore';

// Re-export store hooks with consistent names
export const useAuthStore = authStore;
export const useSongStore = songStore;
export const useVotingStore = voteStore;

// Re-export the toggleAdminMode function
export { toggleAdminMode };
