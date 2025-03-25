
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, useSongStore } from '@/lib/store';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const setCurrentUser = useAuthStore(state => state.setCurrentUser);
  const setSongStoreUser = useSongStore(state => state.setCurrentUser);
  const fetchSongs = useSongStore(state => state.fetchSongs);
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
          
          // We still need to fetch songs for anonymous users
          await fetchSongs();
          return;
        }
        
        // For both INITIAL_SESSION and SIGNED_IN, handle the session similarly
        if (session) {
          try {
            const user = session.user;
            console.log("User from session:", user.id);
            
            // Get admin status from the database with updated parameter name
            const { data: isAdmin, error } = await supabase.rpc('is_admin', {
              id: user.id
            });
            
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
            
            // Update the user in both stores
            setCurrentUser(newUserState);
            setSongStoreUser(newUserState);
            
            // Fetch songs data after user state is updated
            console.log("Refreshing songs data after auth state change");
            await fetchSongs();
            
            if (event === 'SIGNED_IN') {
              toast.success('Signed in successfully');
            }
          } catch (error) {
            console.error("Error in auth state change handler:", error);
            toast.error("An error occurred while processing your authentication");
          }
        } else {
          console.log("No session available in auth state change");
          
          // If it's a meaningful state change (not INITIAL_SESSION with no session)
          // or if we've never fetched songs before, fetch them now for anonymous users
          if (event !== 'INITIAL_SESSION' || !initialCheckDone.current) {
            console.log("Fetching songs for anonymous user");
            await fetchSongs();
          }
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
          // Even if no session, we still need to fetch songs for anonymous users
          await fetchSongs();
          return;
        }
        
        const user = session.user;
        console.log("Initial session found for user:", user.id);
        
        // Get admin status from the database using the updated parameter name
        const { data: isAdmin, error } = await supabase.rpc('is_admin', {
          id: user.id
        });
        
        if (error) {
          console.error("Error checking admin status on initial load:", error);
          // Even if there's an error, still fetch songs
          await fetchSongs();
          return;
        }
        
        console.log("Initial admin status from DB:", isAdmin);
        
        const newUserState = {
          id: user.id,
          isAdmin: Boolean(isAdmin)
        };
        
        // Update the user in both stores
        setCurrentUser(newUserState);
        setSongStoreUser(newUserState);
        
        // Fetch songs data after user state is updated
        console.log("Refreshing songs data after initial session check");
        await fetchSongs();
        
      } catch (error) {
        console.error("Error in initial session check:", error);
        // Even if there's an error, still fetch songs for anonymous users
        await fetchSongs();
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
