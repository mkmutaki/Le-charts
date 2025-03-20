
// Import and re-export all store hooks
import { useAuthStore as authStore, toggleAdminMode } from './stores/useAuthStore';
import { useSongStore as songStore } from './stores/useSongStore';
import { useVotingStore as voteStore } from './stores/useVotingStore';

// Export store hooks with consistent names
export const useAuthStore = authStore;
export const useSongStore = songStore;
export const useVotingStore = voteStore;

// Re-export the toggleAdminMode function
export { toggleAdminMode };
