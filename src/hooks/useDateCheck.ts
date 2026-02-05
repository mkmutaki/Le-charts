import { useState, useEffect, useCallback, useRef } from 'react';
import { getLocalDateString, isNewDay } from '@/lib/dateUtils';

interface UseDateCheckOptions {
  /** Interval in milliseconds to check for date change. Default: 60000 (1 minute) */
  checkInterval?: number;
  /** Callback when date changes */
  onDateChange?: (newDate: string, oldDate: string) => void;
}

interface UseDateCheckReturn {
  /** Current local date in YYYY-MM-DD format */
  currentDate: string;
  /** Whether the date has changed since last check */
  hasDateChanged: boolean;
  /** Reset the date change flag */
  resetDateCheck: () => void;
  /** Force check for date change */
  checkDate: () => boolean;
}

/**
 * Hook to track the current local date and detect when it changes (e.g., at midnight)
 * Useful for Wordle-like apps where content changes daily.
 */
export const useDateCheck = (options: UseDateCheckOptions = {}): UseDateCheckReturn => {
  const { checkInterval = 60000, onDateChange } = options;
  
  const [currentDate, setCurrentDate] = useState<string>(() => getLocalDateString());
  const [hasDateChanged, setHasDateChanged] = useState(false);
  
  // Store the previous date to detect changes
  const previousDateRef = useRef<string>(currentDate);
  
  /**
   * Check if the date has changed and update state accordingly
   * Returns true if date changed, false otherwise
   */
  const checkDate = useCallback((): boolean => {
    const newDate = getLocalDateString();
    const oldDate = previousDateRef.current;
    
    if (isNewDay(oldDate)) {
      console.log(`Date changed from ${oldDate} to ${newDate}`);
      previousDateRef.current = newDate;
      setCurrentDate(newDate);
      setHasDateChanged(true);
      onDateChange?.(newDate, oldDate);
      return true;
    }
    
    return false;
  }, [onDateChange]);
  
  /**
   * Reset the hasDateChanged flag
   * Call this after handling the date change
   */
  const resetDateCheck = useCallback(() => {
    setHasDateChanged(false);
  }, []);
  
  // Set up interval to check for date changes
  useEffect(() => {
    // Initial sync
    const initialDate = getLocalDateString();
    if (initialDate !== previousDateRef.current) {
      previousDateRef.current = initialDate;
      setCurrentDate(initialDate);
    }
    
    // Set up interval for periodic checks
    const intervalId = setInterval(() => {
      checkDate();
    }, checkInterval);
    
    // Also check when the page becomes visible (user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDate();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkDate, checkInterval]);
  
  return {
    currentDate,
    hasDateChanged,
    resetDateCheck,
    checkDate,
  };
};
