import { useEffect, useRef } from 'react';
import { supabase, hasResetToken, hasAuthToken } from '@/integrations/supabase/client';
import { useAuthStore, useSongStore, useVotingStore } from '@/lib/store';
import { getLocalDateString } from '@/lib/dateUtils';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const setCurrentUser = useAuthStore(state => state.setCurrentUser);
  const currentUser = useAuthStore(state => state.currentUser);
  const setSongStoreUser = useSongStore(state => state.setCurrentUser);
  const fetchScheduledSongs = useSongStore(state => state.fetchScheduledSongs);
  const getUserVotedScheduledTrack = useVotingStore(state => state.getUserVotedScheduledTrack);
  const initialCheckDone = useRef(false);
  const processingRef = useRef(false);
  const fetchSongsRef = useRef(false);
  
  // Add timestamp tracking for requests
  const lastFetchTimestamps = useRef({
    songs: 0,
    votes: 0
  });
  
  // Minimum interval between repeated requests (120 seconds / 2 minutes)
  const MIN_REQUEST_INTERVAL = 120000;

  // Process user authentication
  const processUserAuth = async (user, eventType) => {
    // Add debouncing to prevent multiple rapid calls
    if (processingRef.current) {
      console.log(`Auth processing already in progress, skipping redundant ${eventType} event`);
      return;
    }
    
    // Set a longer timeout before allowing new processing
    processingRef.current = true;
    setTimeout(() => { processingRef.current = false; }, 2000); // 2 second cooldown
    
    try {
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
      
      // Check if we recently fetched the voted song before making a new request
      const now = Date.now();
      const today = getLocalDateString();
      if (now - lastFetchTimestamps.current.votes > MIN_REQUEST_INTERVAL) {
        lastFetchTimestamps.current.votes = now;
        await getUserVotedScheduledTrack(today);
      } else {
        console.log('Skipping duplicate vote fetch - too soon since last request');
      }
      
      // Only fetch songs if we haven't already or if user has changed
      if (!isSameUser && !fetchSongsRef.current) {
        fetchSongsRef.current = true;
        // Check timing for songs fetch
        if (now - lastFetchTimestamps.current.songs > MIN_REQUEST_INTERVAL) {
          lastFetchTimestamps.current.songs = now;
          await fetchScheduledSongs();
        } else {
          console.log('Skipping duplicate songs fetch - too soon since last request');
        }
      }
      
      // Only show sign-in toast for explicit SIGNED_IN events
      if (eventType === 'SIGNED_IN' && !isSameUser && !eventType.startsWith('INITIAL')) {
        toast.success('Signed in successfully');
      }
    } catch (error) {
      console.error(`Error in auth state change handler for event ${eventType}:`, error);
      toast.error("An error occurred while processing your authentication");
    }
  };

  // Helper to check if a request should be throttled
  const shouldThrottleRequest = (requestType) => {
    const now = Date.now();
    const lastRequestTime = lastFetchTimestamps.current[requestType] || 0;
    const shouldThrottle = now - lastRequestTime < MIN_REQUEST_INTERVAL;
    
    if (!shouldThrottle) {
      lastFetchTimestamps.current[requestType] = now;
    } else {
      console.log(`Throttling ${requestType} request - too frequent`);
    }
    
    return shouldThrottle;
  };

  useEffect(() => {
    // Check for existing session on mount and ensure fetch happens only once
    const checkInitialSession = async () => {
      if (initialCheckDone.current) return;
      
      try {
        initialCheckDone.current = true;
        
        // Check if we're in a password reset flow - if so, don't auto-sign in
        if (hasResetToken() || hasAuthToken()) {
          console.log("Auth token detected in URL, skipping initial session check");
          
          // Still fetch songs for the page
          if (!fetchSongsRef.current && !shouldThrottleRequest('songs')) {
            fetchSongsRef.current = true;
            await fetchScheduledSongs();
          }
          
          return;
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // For anonymous users, fetch voted track for today if not throttled
          const today = getLocalDateString();
          if (!shouldThrottleRequest('votes')) {
            await getUserVotedScheduledTrack(today);
          }
          
          // Fetch songs only once if not throttled
          if (!fetchSongsRef.current && !shouldThrottleRequest('songs')) {
            fetchSongsRef.current = true;
            await fetchScheduledSongs();
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
        if (!fetchSongsRef.current && !shouldThrottleRequest('songs')) {
          fetchSongsRef.current = true;
          await fetchScheduledSongs();
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip auth processing during password reset
        if (hasResetToken() || hasAuthToken()) {
          console.log("Auth token found, skipping auth state change processing");
          return;
        }
        
        if (event === 'SIGNED_OUT') {
          // Clear the user on sign out
          setCurrentUser(null);
          setSongStoreUser(null);
          toast.info('Signed out');
          
          // Reset fetch tracker and fetch songs once after signout
          fetchSongsRef.current = false;
          setTimeout(async () => {
            if (!shouldThrottleRequest('songs')) {
              fetchSongsRef.current = true;
              await fetchScheduledSongs();
              
              // Also fetch voted track to ensure state is updated if not throttled
              const today = getLocalDateString();
              if (!shouldThrottleRequest('votes')) {
                await getUserVotedScheduledTrack(today);
              }
            }
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
  }, [setCurrentUser, setSongStoreUser, fetchScheduledSongs, getUserVotedScheduledTrack]);

  return null;
};
