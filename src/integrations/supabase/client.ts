
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
     import.meta.env.VITE_SUPABASE_URL,
     import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
     {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  }});

// Helper functions for authentication
export const hasResetToken = () => {
  return window.location.hash.includes('type=recovery');
};

// Add a helper function to check for auth confirmation tokens
export const hasAuthToken = () => {
  return window.location.hash.includes('access_token=') || 
         window.location.hash.includes('refresh_token=');
};
