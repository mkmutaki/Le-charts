
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, useSongStore } from '@/lib/store';
import { toast } from 'sonner';

export const SupabaseListener = () => {
  const { setCurrentUser, checkAdminStatus } = useAuthStore();
  const songStore = useSongStore();
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
          songStore.setCurrentUser(null);
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
          
          // First create a basic user object
          const newUserState = {
            id: user.id,
            isAdmin: false // Default to false initially
          };
          
          // Update the user in both stores right away
          setCurrentUser(newUserState);
          songStore.setCurrentUser(newUserState);
          
          // Then check admin status separately
          const isAdmin = await checkAdminStatus();
          console.log("Admin status after check:", isAdmin);
          
          // Update the user state again with the correct admin status
          if (isAdmin) {
            const updatedUserState = {
              ...newUserState,
              isAdmin: true
            };
            
            setCurrentUser(updatedUserState);
            songStore.setCurrentUser(updatedUserState);
          }
          
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
        
        // First create a basic user object
        const newUserState = {
          id: user.id,
          isAdmin: false // Default to false initially
        };
        
        // Update both stores right away
        setCurrentUser(newUserState);
        songStore.setCurrentUser(newUserState);
        
        // Then check admin status separately
        const isAdmin = await checkAdminStatus();
        console.log("Initial admin status:", isAdmin);
        
        // Update the user state again with the correct admin status
        if (isAdmin) {
          const updatedUserState = {
            ...newUserState,
            isAdmin: true
          };
          
          setCurrentUser(updatedUserState);
          songStore.setCurrentUser(updatedUserState);
        }
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
  }, [setCurrentUser, songStore, checkAdminStatus]);

  return null;
};
