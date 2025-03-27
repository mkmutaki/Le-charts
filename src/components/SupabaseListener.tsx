
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, useSongStore } from '@/lib/store';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const setCurrentUser = useAuthStore(state => state.setCurrentUser);
  const setSongStoreUser = useSongStore(state => state.setCurrentUser);
  const fetchSongs = useSongStore(state => state.fetchSongs);
  const initialCheckDone = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Track auth state processing to prevent concurrent operations
  const processingRef = useRef(false);

  // Process user authentication
  const processUserAuth = async (user, eventType) => {
    // Prevent concurrent processing of the same user
    if (processingRef.current) {
      console.log(`Auth processing already in progress, skipping redundant ${eventType} event`);
      return;
    }
    
    processingRef.current = true;
    setIsProcessing(true);
    
    try {
      console.log(`Processing auth state change (${eventType}) for user:`, user.id);
      
      // Get admin status from the database with updated parameter name
      const { data: isAdmin, error } = await supabase.rpc('is_admin', {
        id: user.id
      });
      
      if (error) {
        console.error(`Error checking admin status for event ${eventType}:`, error);
        toast.error("Error checking permissions");
        return;
      }
      
      console.log(`Auth state changed (${eventType}) - Admin status from DB:`, isAdmin);
      
      const newUserState = {
        id: user.id,
        isAdmin: Boolean(isAdmin)
      };
      
      // Update the user in both stores
      setCurrentUser(newUserState);
      setSongStoreUser(newUserState);
      
      // Fetch songs data after user state is updated
      console.log(`Refreshing songs data after auth state change event: ${eventType}`);
      await fetchSongs();
      
      // Only show sign-in toast for actual SIGNED_IN events, not for session recovery on page reload
      if (eventType === 'SIGNED_IN') {
        toast.success('Signed in successfully');
      }
    } catch (error) {
      console.error(`Error in auth state change handler for event ${eventType}:`, error);
      toast.error("An error occurred while processing your authentication");
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  };

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
          
          // Prevent race conditions by delaying fetch
          setTimeout(async () => {
            // We still need to fetch songs for anonymous users
            await fetchSongs();
          }, 0);
          return;
        }
        
        // Handle both INITIAL_SESSION and SIGNED_IN cases with an active session
        if (session) {
          const user = session.user;
          console.log(`Auth state change (${event}) - User from session:`, user.id);
          
          // Use setTimeout to prevent blocking the auth state change handler
          setTimeout(() => {
            processUserAuth(user, event);
          }, 0);
          return;
        }
        
        // No session available
        console.log(`No session available in auth state change event: ${event}`);
        
        // For initial session or other events with no session, we should still fetch songs
        if (event === 'INITIAL_SESSION' || !initialCheckDone.current) {
          console.log("No session, but fetching songs for anonymous users");
          initialCheckDone.current = true;
          setTimeout(async () => {
            await fetchSongs();
          }, 0);
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
        
        // Process user authentication with delay to avoid race conditions
        setTimeout(() => {
          // Use 'INITIAL_SESSION' instead of 'SIGNED_IN' to avoid showing the success toast on page reload
          processUserAuth(user, 'INITIAL_SESSION');
        }, 0);
        
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

  // Render nothing, but prevent app from rendering content until authentication is checked
  // This prevents the UI from flickering between unauthenticated and authenticated states
  return null;
};
