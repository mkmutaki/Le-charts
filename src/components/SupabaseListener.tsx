
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, useSongStore, useVotingStore } from '@/lib/store';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const setCurrentUser = useAuthStore(state => state.setCurrentUser);
  const currentUser = useAuthStore(state => state.currentUser);
  const setSongStoreUser = useSongStore(state => state.setCurrentUser);
  const fetchSongs = useSongStore(state => state.fetchSongs);
  const getUserVotedSong = useVotingStore(state => state.getUserVotedSong);
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
      
      // Fetch user's voted song once (this helps prevent duplicate queries)
      await getUserVotedSong();
      
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
    // Check for existing session on mount and ensure fetch happens only once
    const checkInitialSession = async () => {
      if (initialCheckDone.current) return;
      
      try {
        initialCheckDone.current = true;
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // For anonymous users, fetch voted song once
          await getUserVotedSong();
          
          // Fetch songs only once
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
            // Also fetch voted song to ensure state is updated
            await getUserVotedSong();
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
      }
    );

    // Execute the initial session check
    checkInitialSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [setCurrentUser, setSongStoreUser, fetchSongs, getUserVotedSong]);

  return null;
};
