import { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScheduleStore } from '@/lib/stores/useScheduleStore';
import { ScheduledAlbum } from '@/lib/services/scheduledAlbumService';
import { 
  formatScheduledDate, 
  getRelativeDayDescription, 
  isWeekend, 
  isPastDate 
} from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EditScheduleModalProps {
  isOpen: boolean;
  schedule: ScheduledAlbum | null;
  onClose: () => void;
  onUpdated?: () => void;
}

export const EditScheduleModal = ({ isOpen, schedule, onClose, onUpdated }: EditScheduleModalProps) => {
  const { updateScheduleDate, checkDateConflict, isLoading: storeLoading } = useScheduleStore();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dateConflict, setDateConflict] = useState<ScheduledAlbum | null>(null);
  const [isCheckingDate, setIsCheckingDate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  
  // Initialize selected date from schedule
  useEffect(() => {
    if (schedule && isOpen) {
      setSelectedDate(new Date(schedule.scheduled_date + 'T00:00:00'));
    }
  }, [schedule, isOpen]);
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedDate(undefined);
      setDateConflict(null);
      setShowReplaceConfirm(false);
    }
  }, [isOpen]);
  
  // Check for date conflicts when date is selected
  useEffect(() => {
    const checkConflict = async () => {
      if (!selectedDate || !schedule) {
        setDateConflict(null);
        return;
      }
      
      const newDateString = formatDateToString(selectedDate);
      
      // Don't check conflict if date hasn't changed
      if (newDateString === schedule.scheduled_date) {
        setDateConflict(null);
        return;
      }
      
      setIsCheckingDate(true);
      try {
        const conflict = await checkDateConflict(newDateString);
        // Exclude current schedule from conflict
        if (conflict && conflict.id !== schedule.id) {
          setDateConflict(conflict);
        } else {
          setDateConflict(null);
        }
      } catch (error) {
        console.error('Error checking date conflict:', error);
      } finally {
        setIsCheckingDate(false);
      }
    };
    
    checkConflict();
  }, [selectedDate, schedule, checkDateConflict]);
  
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isUpdating) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isUpdating, onClose]);
  
  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const handleUpdate = async (replaceExisting: boolean = false) => {
    if (!schedule || !selectedDate) return;
    
    const newDateString = formatDateToString(selectedDate);
    
    // No change
    if (newDateString === schedule.scheduled_date) {
      onClose();
      return;
    }
    
    // Check for conflict and show confirmation if not replacing
    if (dateConflict && !replaceExisting) {
      setShowReplaceConfirm(true);
      return;
    }
    
    setIsUpdating(true);
    
    try {
      const result = await updateScheduleDate(schedule.id, newDateString);
      
      if (result.success) {
        onUpdated?.();
        onClose();
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
    } finally {
      setIsUpdating(false);
      setShowReplaceConfirm(false);
    }
  };
  
  // Disable dates function for calendar
  const isDateDisabled = (date: Date): boolean => {
    const dateString = formatDateToString(date);
    // Disable past dates and weekends
    return isPastDate(dateString) || isWeekend(dateString);
  };
  
  const hasDateChanged = schedule && selectedDate 
    ? formatDateToString(selectedDate) !== schedule.scheduled_date 
    : false;
  
  if (!isOpen || !schedule) return null;
  
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div 
          className="bg-card rounded-2xl shadow-lg w-full max-w-md overflow-hidden animate-scale-up flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="text-xl font-semibold">Edit Schedule</h2>
            <button 
              onClick={onClose}
              className="p-1 rounded-full hover:bg-muted transition-colors"
              aria-label="Close modal"
              disabled={isUpdating}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-5 space-y-6">
            {/* Album preview */}
            <div className="flex gap-4 p-4 bg-muted/30 rounded-lg">
              <img
                src={schedule.artwork_url}
                alt={`${schedule.album_name} cover`}
                className="w-20 h-20 rounded-lg shadow-md flex-shrink-0 object-cover"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold line-clamp-2">{schedule.album_name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{schedule.artist_name}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Currently scheduled: {formatScheduledDate(schedule.scheduled_date)}
                </p>
              </div>
            </div>
            
            {/* Date picker */}
            <div className="space-y-3">
              <label className="text-sm font-medium">New Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                    disabled={isUpdating}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? (
                      <>
                        {formatScheduledDate(formatDateToString(selectedDate))}
                        <span className="ml-2 text-muted-foreground">
                          ({getRelativeDayDescription(formatDateToString(selectedDate))})
                        </span>
                      </>
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={isDateDisabled}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              {/* Date conflict warning */}
              {dateConflict && (
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                      This date already has a scheduled album
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      "{dateConflict.album_name}" is currently scheduled for this date.
                      Saving will replace it.
                    </p>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Only weekdays (Monday - Friday) are available for scheduling.
              </p>
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-5 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleUpdate(false)}
              disabled={!hasDateChanged || isUpdating || isCheckingDate}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Replace confirmation dialog */}
      <AlertDialog open={showReplaceConfirm} onOpenChange={setShowReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Scheduled Album?</AlertDialogTitle>
            <AlertDialogDescription>
              "{dateConflict?.album_name}" is already scheduled for this date. 
              Moving "{schedule.album_name}" to this date will replace it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleUpdate(true)}
              disabled={isUpdating}
              className="bg-primary"
            >
              {isUpdating ? 'Replacing...' : 'Replace Album'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
