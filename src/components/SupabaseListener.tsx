
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, useSongStore } from '@/lib/store';
import { toast } from 'sonner';
import { createBaseStore } from '@/lib/stores/useBaseStore';

export const SupabaseListener = () => {
  const setCurrentUser = useAuthStore(state => state.setCurrentUser);
  const currentUser = useAuthStore(state => state.currentUser);
  const setSongStoreUser = useSongStore(state => state.setCurrentUser);
  const fetchSongs = useSongStore(state => state.fetchSongs);
  const initialCheckDone = useRef(false);
  const processingRef = useRef(false);

  // Process user authentication
  const processUserAuth = async (user, eventType) => {
    // Prevent concurrent processing of the same user
    if (processingRef.current) {
      console.log(`Auth processing already in progress, skipping redundant ${eventType} event`);
      return;
    }
    
    processingRef.current = true;
    
    try {
      console.log(`Processing auth state change (${eventType}) for user:`, user.id);
      
      // Check if this is the same user that's already authenticated (for reload scenario)
      const isSameUser = currentUser && currentUser.id === user.id;
      
      // Get admin status from the database with updated parameter name
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
      
      // Fetch songs data after user state is updated
      await fetchSongs();
      
      // Only show sign-in toast for explicit SIGNED_IN events, not for session recovery or same user reload
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
    console.log("Setting up SupabaseListener");
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change event:", event);
        
        if (event === 'SIGNED_OUT') {
          // Clear the user on sign out
          setCurrentUser(null);
          setSongStoreUser(null);
          toast.info('Signed out');
          
          // Fetch songs for anonymous users
          setTimeout(async () => {
            await fetchSongs();
          }, 0);
          return;
        }
        
        // Handle both INITIAL_SESSION and SIGNED_IN cases with an active session
        if (session) {
          const user = session.user;
          
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
        return;
      }
      
      try {
        initialCheckDone.current = true;
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // Even if no session, we still need to fetch songs for anonymous users
          await fetchSongs();
          return;
        }
        
        const user = session.user;
        
        // Process user authentication with delay to avoid race conditions
        setTimeout(() => {
          // Use 'INITIAL_SESSION' event type to avoid showing the success toast on page reload
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

  return null;
};
