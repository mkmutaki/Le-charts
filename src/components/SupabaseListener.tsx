
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, useSongStore } from '@/lib/store';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const setCurrentUser = useAuthStore(state => state.setCurrentUser);
  const currentUser = useAuthStore(state => state.currentUser);
  const setSongStoreUser = useSongStore(state => state.setCurrentUser);
  const fetchSongs = useSongStore(state => state.fetchSongs);
  const initialCheckDone = useRef(false);
  const processingRef = useRef(false);
  const fetchSongsRef = useRef(false);

  // Process user authentication
  const processUserAuth = async (user, eventType) => {
    if (processingRef.current) {
      console.log(`Auth processing already in progress, skipping redundant ${eventType} event`);
      return;
    }
    
    processingRef.current = true;
    
    try {
      console.log(`Processing auth state change (${eventType}) for user:`, user.id);
      
      // Check if this is the same user that's already authenticated
      const isSameUser = currentUser && currentUser.id === user.id;
      
      // Get admin status from the database
      const { data: isAdmin, error } = await supabase.rpc('is_admin', {
        id: user.id
      });
      
      if (error) {
        console.error(`Error checking admin status for event ${eventType}:`, error);
        toast.error("Error checking permissions");
        return;
      }
      
      const newUserState = {
        id: user.id,
        isAdmin: Boolean(isAdmin)
      };
      
      // Update the user in both stores
      setCurrentUser(newUserState);
      setSongStoreUser(newUserState);
      
      // Only fetch songs if we haven't already or if user has changed
      if (!isSameUser && !fetchSongsRef.current) {
        fetchSongsRef.current = true;
        await fetchSongs();
      }
      
      // Only show sign-in toast for explicit SIGNED_IN events
      if (eventType === 'SIGNED_IN' && !isSameUser && !eventType.startsWith('INITIAL')) {
        toast.success('Signed in successfully');
      }
    } catch (error) {
      console.error(`Error in auth state change handler for event ${eventType}:`, error);
      toast.error("An error occurred while processing your authentication");
    } finally {
      processingRef.current = false;
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change event:", event);
        
        if (event === 'SIGNED_OUT') {
          // Clear the user on sign out
          setCurrentUser(null);
          setSongStoreUser(null);
          toast.info('Signed out');
          
          // Reset fetch tracker and fetch songs once after signout
          fetchSongsRef.current = false;
          setTimeout(async () => {
            fetchSongsRef.current = true;
            await fetchSongs();
          }, 0);
          return;
        }
        
        // Handle cases with an active session
        if (session) {
          const user = session.user;
          
          // Use setTimeout to prevent blocking the auth state change handler
          setTimeout(() => {
            processUserAuth(user, event);
          }, 0);
          return;
        }
        
        // For initial session with no session, fetch songs only once
        if ((event === 'INITIAL_SESSION' || !initialCheckDone.current) && !fetchSongsRef.current) {
          initialCheckDone.current = true;
          fetchSongsRef.current = true;
          setTimeout(async () => {
            await fetchSongs();
          }, 0);
        }
      }
    );

    // Check for existing session on mount
    const checkInitialSession = async () => {
      if (initialCheckDone.current) return;
      
      try {
        initialCheckDone.current = true;
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // Fetch songs only once for anonymous users
          if (!fetchSongsRef.current) {
            fetchSongsRef.current = true;
            await fetchSongs();
          }
          return;
        }
        
        const user = session.user;
        
        // Process user authentication with delay to avoid race conditions
        setTimeout(() => {
          processUserAuth(user, 'INITIAL_SESSION');
        }, 0);
        
      } catch (error) {
        console.error("Error in initial session check:", error);
        // Fetch songs only once even if there's an error
        if (!fetchSongsRef.current) {
          fetchSongsRef.current = true;
          await fetchSongs();
        }
      }
    };

    // Execute the initial session check
    checkInitialSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentUser, setSongStoreUser, fetchSongs]);

  return null;
};
