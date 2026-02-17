// src/lib/stores/useScheduleStore.ts
// Zustand store for managing scheduled albums

import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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

// Track fetch timestamps to prevent duplicate requests
const lastFetchTimestamp = { current: 0 };
const MIN_FETCH_INTERVAL = 30000; // 30 seconds

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

// Track fetch timestamps for completed albums
const lastCompletedFetchTimestamp = { current: 0 };

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
        console.log('Skipping fetchScheduledAlbums - too soon since last fetch');
        return;
      }
      lastFetchTimestamp.current = now;

      // ADD THIS CHECK - Exit early if no user is logged in
  const currentUser = useAuthStore.getState().currentUser;
  if (!currentUser?.id) {
    console.log(currentUser)
    console.log('No current user, skipping fetchScheduledAlbums');
    set({ scheduledAlbums: [], isLoading: false });
    return;
  }
      
      set({ isLoading: true, error: null });
      
      try {
        // Verify admin status before fetching
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: currentUser.id
        });

        console.log
        
        if (adminError || !isAdmin) {
          // Non-admins shouldn't see pending schedules
          set({ scheduledAlbums: [], isLoading: false });
          return;
        }
        
        const albums = await getScheduledAlbumsService('pending');
        set({ scheduledAlbums: albums, isLoading: false });
      } catch (error) {
        console.error('Error fetching scheduled albums:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch scheduled albums',
          isLoading: false 
        });
      }
    },
    
    fetchCompletedAlbums: async (options = {}) => {
      const { force = false } = options;
      
      // Throttle requests unless forced
      const now = Date.now();
      if (!force && now - lastCompletedFetchTimestamp.current < MIN_FETCH_INTERVAL) {
        console.log('Skipping fetchCompletedAlbums - too soon since last fetch');
        return;
      }
      lastCompletedFetchTimestamp.current = now;

      const currentUser = useAuthStore.getState().currentUser;
      if (!currentUser?.id) {
        console.log('No current user, skipping fetchCompletedAlbums');
        set({ completedAlbums: [], isLoadingCompleted: false });
        return;
      }
      
      set({ isLoadingCompleted: true, error: null });
      
      try {
        // Verify admin status before fetching
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: currentUser.id
        });
        
        if (adminError || !isAdmin) {
          set({ completedAlbums: [], isLoadingCompleted: false });
          return;
        }
        
        const albums = await getScheduledAlbumsService('completed');
        set({ completedAlbums: albums, isLoadingCompleted: false });
      } catch (error) {
        console.error('Error fetching completed albums:', error);
        set({ 
          error: error instanceof Error ? error.message : 'Failed to fetch completed albums',
          isLoadingCompleted: false 
        });
      }
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

        // ADD THIS CHECK - Exit early if no user is logged in
  const currentUser = useAuthStore.getState().currentUser;
  if (!currentUser?.id) {
    console.log(currentUser)
    const error = 'You must be logged in to schedule albums';
      toast.error(error);
      return { success: false, error };
  }
        // Verify admin status
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: currentUser.id
        });
        
        if (adminError || !isAdmin) {
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
        const errorMessage = error instanceof Error ? error.message : 'Failed to schedule album';
        set({ error: errorMessage, isLoading: false });
        toast.error(errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    
    updateScheduleDate: async (id, newDate) => {
      try {
        const currentUser = useAuthStore.getState().currentUser;
        // Verify admin status
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: currentUser?.id
        });
        
        if (adminError || !isAdmin) {
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
        const errorMessage = error instanceof Error ? error.message : 'Failed to update schedule';
        set({ error: errorMessage, isLoading: false });
        toast.error(errorMessage);
        return { success: false, error: errorMessage };
      }
    },
    
    deleteSchedule: async (id) => {
      try {
        const currentUser = useAuthStore.getState().currentUser;
        // Verify admin status
        const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin', {
          id: currentUser?.id
        });
        
        if (adminError || !isAdmin) {
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
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete schedule';
        set({ error: errorMessage, isLoading: false });
        toast.error(errorMessage);
        return { success: false, error: errorMessage };
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
