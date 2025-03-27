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
        
        // Handle both INITIAL_SESSION and SIGNED_IN cases with an active session
        if (session) {
          try {
            const user = session.user;
            console.log(`Auth state change (${event}) - User from session:`, user.id);
            
            // Get admin status from the database with updated parameter name
            const { data: isAdmin, error } = await supabase.rpc('is_admin', {
              id: user.id
            });
            
            if (error) {
              console.error(`Error checking admin status for event ${event}:`, error);
              toast.error("Error checking permissions");
              
              // Even if there's an error checking admin status, still fetch songs
              if (event === 'INITIAL_SESSION') {
                await fetchSongs();
              }
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
            console.log(`Refreshing songs data after auth state change event: ${event}`);
            await fetchSongs();
            
            if (event === 'SIGNED_IN') {
              toast.success('Signed in successfully');
            }
          } catch (error) {
            console.error(`Error in auth state change handler for event ${event}:`, error);
            toast.error("An error occurred while processing your authentication");
            
            // Make sure songs are still fetched on initial load even if there's an error
            if (event === 'INITIAL_SESSION') {
              await fetchSongs();
            }
          }
          return;
        }
        
        // No session available
        console.log(`No session available in auth state change event: ${event}`);
        
        // For initial session or other events with no session, we should still fetch songs
        if (event === 'INITIAL_SESSION' || !initialCheckDone.current) {
          console.log("No session, but fetching songs for anonymous users");
          initialCheckDone.current = true;
          await fetchSongs();
        }
      }
    );

    // Check for existing session on mount - only if not already checked
    const checkInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error fetching session:', error);
          throw error;
        }

        if (!session) {
          console.log('No active session found');
          await fetchSongs(); // Fetch songs for anonymous users
          return;
        }

        const user = session.user;
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', { id: user.id });

        if (adminError) {
          console.error('Error checking admin status:', adminError);
          throw adminError;
        }

        const newUserState = { id: user.id, isAdmin: Boolean(isAdmin) };
        setCurrentUser(newUserState);
        setSongStoreUser(newUserState);

        await fetchSongs(); // Fetch songs after user state is updated
      } catch (error) {
        console.error('Error during initial session check:', error);
        toast.error('Failed to initialize session');
        await fetchSongs(); // Fallback to fetch songs for anonymous users
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
