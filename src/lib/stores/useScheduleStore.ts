// src/lib/stores/useScheduleStore.ts
// Zustand store for managing scheduled albums

import { toast } from 'sonner';
import { createBaseStore, BaseState } from './useBaseStore';
import {
  ScheduledAlbum,
  ScheduledAlbumWithTracks,
  ScheduleAlbumData,
  ScheduleTrackData,
  scheduleAlbum as scheduleAlbumService,
  getScheduledAlbums as getScheduledAlbumsService,
  getAlbumForDate as getAlbumForDateService,
  updateScheduledAlbum as updateScheduledAlbumService,
  deleteScheduledAlbum as deleteScheduledAlbumService,
  checkDateAvailability as checkDateAvailabilityService,
} from '../services/scheduledAlbumService';
import { getLocalDateString } from '../dateUtils';
import { useAuthStore } from './useAuthStore';
import { isAdminUser } from '../services/adminService';

// Track fetch timestamps to prevent duplicate requests
const lastFetchTimestamp = { current: 0 };
const MIN_FETCH_INTERVAL = 30000; // 30 seconds

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const handleActionError = (
  set: (partial: Partial<ScheduleState>) => void,
  error: unknown,
  fallback: string
) => {
  const errorMessage = getErrorMessage(error, fallback);
  set({ error: errorMessage, isLoading: false });
  toast.error(errorMessage);
  return { success: false, error: errorMessage };
};

interface ScheduleState extends BaseState {
  // State
  scheduledAlbums: ScheduledAlbum[];
  completedAlbums: ScheduledAlbum[];
  todayAlbum: ScheduledAlbumWithTracks | null;
  isLoading: boolean;
  isLoadingCompleted: boolean;
  error: string | null;
  
  // Actions
  fetchScheduledAlbums: (options?: { force?: boolean }) => Promise<void>;
  fetchCompletedAlbums: (options?: { force?: boolean }) => Promise<void>;
  fetchTodayAlbum: (options?: { force?: boolean }) => Promise<ScheduledAlbumWithTracks | null>;
  scheduleAlbum: (
    albumData: ScheduleAlbumData,
    tracks: ScheduleTrackData[],
    scheduledDate: string,
    replaceExisting?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  updateScheduleDate: (id: string, newDate: string) => Promise<{ success: boolean; error?: string }>;
  deleteSchedule: (id: string) => Promise<{ success: boolean; error?: string }>;
  checkDateConflict: (date: string) => Promise<ScheduledAlbum | null>;
  clearTodayAlbum: () => void;
}

export const useScheduleStore = createBaseStore<ScheduleState>(
  (set, get) => ({
    scheduledAlbums: [],
    completedAlbums: [],
    todayAlbum: null,
    isLoading: false,
    isLoadingCompleted: false,
    error: null,
    
    fetchScheduledAlbums: async (options = {}) => {
      const { force = false } = options;
      
      // Throttle requests unless forced
      const now = Date.now();
      if (!force && now - lastFetchTimestamp.current < MIN_FETCH_INTERVAL) {
        return;
      }
      lastFetchTimestamp.current = now;

      const currentUser = useAuthStore.getState().currentUser;
      if (!currentUser?.id) {
        set({ scheduledAlbums: [], completedAlbums: [], isLoading: false });
        return;
      }
      
      set({ isLoading: true, error: null });
      
      try {
        const isAdmin = await isAdminUser(currentUser.id);
        if (!isAdmin) {
          set({ scheduledAlbums: [], completedAlbums: [], isLoading: false });
          return;
        }
        
        // Fetch ALL albums and categorize client-side using local timezone
        const allAlbums = await getScheduledAlbumsService('all');
        const localToday = getLocalDateString();
        
        const scheduled = allAlbums.filter(a => a.scheduled_date >= localToday);
        const completed = allAlbums.filter(a => a.scheduled_date < localToday);
        
        set({ scheduledAlbums: scheduled, completedAlbums: completed, isLoading: false, isLoadingCompleted: false });
      } catch (error) {
        console.error('Error fetching scheduled albums:', error);
        set({ 
          error: getErrorMessage(error, 'Failed to fetch scheduled albums'),
          isLoading: false 
        });
      }
    },
    
    fetchCompletedAlbums: async (options = {}) => {
      // Completed albums are now populated by fetchScheduledAlbums.
      // If they're already loaded, skip. Otherwise delegate to fetchScheduledAlbums.
      const { force = false } = options;
      const { completedAlbums } = get();
      if (!force && completedAlbums.length > 0) return;
      
      // Re-use fetchScheduledAlbums which fetches all and splits by local date
      await get().fetchScheduledAlbums({ force });
    },
    
    fetchTodayAlbum: async (options = {}) => {
      const { force = false } = options;
      
      // If we already have today's album and not forcing, return it
      const currentAlbum = get().todayAlbum;
      if (!force && currentAlbum) {
        const today = getLocalDateString();
        if (currentAlbum.album.scheduled_date === today) {
          return currentAlbum;
        }
      }
      
      set({ isLoading: true, error: null });
      
      try {
        const today = getLocalDateString();
        const albumWithTracks = await getAlbumForDateService(today);
        
        set({ todayAlbum: albumWithTracks, isLoading: false });
        return albumWithTracks;
      } catch (error) {
        console.error('Error fetching today\'s album:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch today\'s album',
          isLoading: false,
          todayAlbum: null 
        });
        return null;
      }
    },
    
    scheduleAlbum: async (albumData, tracks, scheduledDate, replaceExisting = false) => {
      try {
        const currentUser = useAuthStore.getState().currentUser;
        if (!currentUser?.id) {
          const error = 'You must be logged in to schedule albums';
          toast.error(error);
          return { success: false, error };
        }

        const isAdmin = await isAdminUser(currentUser.id);
        if (!isAdmin) {
          const error = 'Only admins can schedule albums';
          toast.error(error);
          return { success: false, error };
        }
        
        set({ isLoading: true, error: null });
        
        const result = await scheduleAlbumService(albumData, tracks, scheduledDate, replaceExisting);
        
        if (result.success) {
          toast.success(`Album "${albumData.albumName}" scheduled for ${scheduledDate}`);
          // Refresh the list
          await get().fetchScheduledAlbums({ force: true });
        } else {
          toast.error(result.error || 'Failed to schedule album');
        }
        
        set({ isLoading: false });
        return result;
      } catch (error) {
        console.error('Error scheduling album:', error);
        return handleActionError(set, error, 'Failed to schedule album');
      }
    },
    
    updateScheduleDate: async (id, newDate) => {
      try {
        const isAdmin = await isAdminUser(useAuthStore.getState().currentUser?.id);
        if (!isAdmin) {
          const error = 'Only admins can update schedules';
          toast.error(error);
          return { success: false, error };
        }
        
        set({ isLoading: true, error: null });
        
        const result = await updateScheduledAlbumService(id, { scheduled_date: newDate });
        
        if (result.success) {
          toast.success('Schedule updated successfully');
          // Refresh the list
          await get().fetchScheduledAlbums({ force: true });
        } else {
          toast.error(result.error || 'Failed to update schedule');
        }
        
        set({ isLoading: false });
        return result;
      } catch (error) {
        console.error('Error updating schedule:', error);
        return handleActionError(set, error, 'Failed to update schedule');
      }
    },
    
    deleteSchedule: async (id) => {
      try {
        const isAdmin = await isAdminUser(useAuthStore.getState().currentUser?.id);
        if (!isAdmin) {
          const error = 'Only admins can delete schedules';
          toast.error(error);
          return { success: false, error };
        }
        
        set({ isLoading: true, error: null });
        
        const result = await deleteScheduledAlbumService(id);
        
        if (result.success) {
          toast.success('Scheduled album deleted');
          // Update local state immediately
          set((state) => ({
            scheduledAlbums: state.scheduledAlbums.filter((a) => a.id !== id),
            isLoading: false,
          }));
        } else {
          toast.error(result.error || 'Failed to delete scheduled album');
          set({ isLoading: false });
        }
        
        return result;
      } catch (error) {
        console.error('Error deleting schedule:', error);
        return handleActionError(set, error, 'Failed to delete schedule');
      }
    },
    
    checkDateConflict: async (date) => {
      try {
        return await checkDateAvailabilityService(date);
      } catch (error) {
        console.error('Error checking date conflict:', error);
        return null;
      }
    },
    
    clearTodayAlbum: () => {
      set({ todayAlbum: null });
    },
  }),
  'schedule-store'
);
