
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, useSongStore } from '@/lib/store';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const { setCurrentUser } = useAuthStore();
  const { setCurrentUser: setSongStoreUser, fetchSongs } = useSongStore();
  const initialCheckDone = useRef(false);

  useEffect(() => {
    console.log("Setting up SupabaseListener");
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change event:", event);
        
        if (event === 'SIGNED_OUT') {
          // Clear the user on sign out
          console.log("User signed out, clearing user state");
          setCurrentUser(null);
          setSongStoreUser(null);
          toast.info('Signed out');
          return;
        }
        
        if (!session) {
          console.log("No session available in auth state change");
          return;
        }

        try {
          const user = session.user;
          console.log("User from session:", user.id);
          
          // DEBUGGING: Log the user ID being used for the is_admin check
          console.log("Checking admin status for user ID:", user.id);
          
          // Get admin status from the database with updated parameter name
          const { data: isAdmin, error } = await supabase.rpc('is_admin', {
            id: user.id
          });
          
          // DEBUGGING: Log the raw response from the is_admin RPC call
          console.log("Raw is_admin RPC response:", { data: isAdmin, error });
          
          if (error) {
            console.error("Error checking admin status:", error);
            toast.error("Error checking permissions");
            return;
          }
          
          console.log(`Auth state changed (${event}) - Admin status from DB:`, isAdmin);
          
          const newUserState = {
            id: user.id,
            isAdmin: Boolean(isAdmin)
          };
          
          // DEBUGGING: Log the new user state before updating
          console.log("Setting new user state:", newUserState);
          
          // Update the user in both stores
          setCurrentUser(newUserState);
          setSongStoreUser(newUserState);
          
          // Fetch songs data regardless of admin status
          // Important: Place this after setting user state but before any 
          // conditional logic that might skip execution
          console.log("Refreshing songs data after auth state change");
          await fetchSongs();
          
          if (event === 'SIGNED_IN') {
            toast.success('Signed in successfully');
          }
        } catch (error) {
          console.error("Error in auth state change handler:", error);
          toast.error("An error occurred while processing your authentication");
        }
      }
    );

    // Check for existing session on mount - only if not already checked
    const checkInitialSession = async () => {
      if (initialCheckDone.current) {
        console.log("Initial session already checked, skipping");
        return;
      }
      
      try {
        initialCheckDone.current = true;
        console.log("Checking for initial session");
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log("No active session found on initial load");
          return;
        }
        
        const user = session.user;
        console.log("Initial session found for user:", user.id);
        
        // DEBUGGING: Log the user ID for initial admin check
        console.log("Initial check - Admin status check for user ID:", user.id);
        
        // Get admin status from the database using the updated parameter name
        const { data: isAdmin, error } = await supabase.rpc('is_admin', {
          id: user.id
        });
        
        // DEBUGGING: Log the raw response from the is_admin RPC call
        console.log("Initial check - Raw is_admin RPC response:", { data: isAdmin, error });
        
        if (error) {
          console.error("Error checking admin status on initial load:", error);
          return;
        }
        
        console.log("Initial admin status from DB:", isAdmin);
        
        const newUserState = {
          id: user.id,
          isAdmin: Boolean(isAdmin)
        };
        
        // DEBUGGING: Log the new user state before updating
        console.log("Initial check - Setting new user state:", newUserState);
        
        // Update the user in both stores
        setCurrentUser(newUserState);
        setSongStoreUser(newUserState);
        
        // Fetch songs data regardless of admin status
        // Important: Place this after setting user state
        console.log("Refreshing songs data after initial session check");
        await fetchSongs();
        
      } catch (error) {
        console.error("Error in initial session check:", error);
      }
    };

    // Execute the initial session check
    checkInitialSession();

    return () => {
      console.log("Cleaning up SupabaseListener");
      subscription.unsubscribe();
    };
  }, [setCurrentUser, setSongStoreUser, fetchSongs]);

  return null;
};
