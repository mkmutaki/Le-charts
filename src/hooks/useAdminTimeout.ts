import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TIMEOUT_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
const WARNING_DURATION = 60 * 1000; // 1 minute warning before timeout

interface UseAdminTimeoutOptions {
  enabled?: boolean;
  onTimeout?: () => void;
}

export const useAdminTimeout = (options: UseAdminTimeoutOptions = {}) => {
  const { enabled = true, onTimeout } = options;
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const warningToastId = useRef<string | number | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
    // Dismiss warning toast if it exists
    if (warningToastId.current) {
      toast.dismiss(warningToastId.current);
      warningToastId.current = null;
    }
  }, []);

  const handleTimeout = useCallback(async () => {
    clearTimers();
    
    try {
      await supabase.auth.signOut();
      toast.error('Session expired due to inactivity', {
        description: 'Please log in again to continue.',
        duration: 5000,
      });
      
      if (onTimeout) {
        onTimeout();
      } else {
        navigate('/login', { replace: true });
      }
    } catch (error) {
      console.error('Error signing out on timeout:', error);
      navigate('/login', { replace: true });
    }
  }, [clearTimers, navigate, onTimeout]);

  const showWarning = useCallback(() => {
    warningToastId.current = toast.warning('Session expiring soon', {
      description: 'Your session will expire in 1 minute due to inactivity. Move your mouse or press a key to stay logged in.',
      duration: WARNING_DURATION,
    });
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    clearTimers();

    // Set warning timer (fires 1 minute before timeout)
    warningRef.current = setTimeout(() => {
      showWarning();
    }, TIMEOUT_DURATION - WARNING_DURATION);

    // Set timeout timer
    timeoutRef.current = setTimeout(() => {
      handleTimeout();
    }, TIMEOUT_DURATION);
  }, [enabled, clearTimers, showWarning, handleTimeout]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    // Activity events to track
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle the reset to avoid excessive timer resets
    let lastActivity = Date.now();
    const throttleMs = 1000; // Only reset timer at most once per second

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivity >= throttleMs) {
        lastActivity = now;
        resetTimer();
      }
    };

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start initial timer
    resetTimer();

    // Cleanup
    return () => {
      clearTimers();
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer, clearTimers]);

  return { resetTimer };
};
