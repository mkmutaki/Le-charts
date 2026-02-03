import { useState, useEffect, useCallback } from 'react';
import { X, Search, Loader2, Music, Calendar as CalendarIcon, ArrowLeft, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScheduleStore } from '@/lib/stores/useScheduleStore';
import { toast } from 'sonner';
import { searchAlbums, getAlbumTracks, ITunesAlbum, ITunesTrack } from '@/lib/services/spotifyService';
import { 
  convertAlbumToScheduleData, 
  convertTracksToScheduleData,
  ScheduledAlbum 
} from '@/lib/services/scheduledAlbumService';
import { 
  formatScheduledDate, 
  getRelativeDayDescription, 
  isWeekend, 
  isPastDate,
  getNextWeekday,
  getLocalDateString
} from '@/lib/dateUtils';
import { Skeleton } from '@/components/ui/skeleton';
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

interface ScheduleAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled?: () => void;
}

type ModalStep = 'search' | 'schedule';

export const ScheduleAlbumModal = ({ isOpen, onClose, onScheduled }: ScheduleAlbumModalProps) => {
  const { scheduleAlbum, checkDateConflict, isLoading: storeLoading } = useScheduleStore();
  
  // Step management
  const [currentStep, setCurrentStep] = useState<ModalStep>('search');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ITunesAlbum[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Selected album state
  const [selectedAlbum, setSelectedAlbum] = useState<ITunesAlbum | null>(null);
  const [albumTracks, setAlbumTracks] = useState<ITunesTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  
  // Date selection state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [dateConflict, setDateConflict] = useState<ScheduledAlbum | null>(null);
  const [isCheckingDate, setIsCheckingDate] = useState(false);
  
  // Scheduling state
  const [isScheduling, setIsScheduling] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  
  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchAlbums(searchQuery);
        setSearchResults(results.slice(0, 50));
      } catch (error) {
        console.error('Search error:', error);
        if (error instanceof Error) {
          toast.error(error.message);
        } else {
          toast.error('Failed to search albums. Please try again.');
        }
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('search');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedAlbum(null);
      setAlbumTracks([]);
      setSelectedDate(undefined);
      setDateConflict(null);
      setShowReplaceConfirm(false);
    }
  }, [isOpen]);
  
  // Check for date conflicts when date is selected
  useEffect(() => {
    const checkConflict = async () => {
      if (!selectedDate) {
        setDateConflict(null);
        return;
      }
      
      setIsCheckingDate(true);
      try {
        const dateString = formatDateToString(selectedDate);
        const conflict = await checkDateConflict(dateString);
        setDateConflict(conflict);
      } catch (error) {
        console.error('Error checking date conflict:', error);
      } finally {
        setIsCheckingDate(false);
      }
    };
    
    checkConflict();
  }, [selectedDate, checkDateConflict]);
  
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isScheduling) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isScheduling, onClose]);
  
  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const handleAlbumSelect = async (album: ITunesAlbum) => {
    // Validate album art URL
    if (!album.artworkUrl600 && !album.artworkUrl100) {
      toast.error('This album is missing artwork and cannot be scheduled');
      return;
    }

    setSelectedAlbum(album);
    setIsLoadingTracks(true);
    
    try {
      const tracks = await getAlbumTracks(album.collectionId);
      
      if (!tracks || tracks.length === 0) {
        toast.error('This album has no tracks and cannot be scheduled');
        setSelectedAlbum(null);
        return;
      }
      
      setAlbumTracks(tracks);
      setCurrentStep('schedule');
      
      // Set default date to next weekday
      const nextWeekday = getNextWeekday();
      setSelectedDate(new Date(nextWeekday + 'T00:00:00'));
    } catch (error) {
      console.error('Error loading tracks:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to load album tracks. Please try again.');
      }
      setSelectedAlbum(null);
    } finally {
      setIsLoadingTracks(false);
    }
  };
  
  const handleBackToSearch = () => {
    setCurrentStep('search');
    setSelectedAlbum(null);
    setAlbumTracks([]);
    setSelectedDate(undefined);
    setDateConflict(null);
  };
  
  const handleSchedule = async (replaceExisting: boolean = false) => {
    if (!selectedAlbum || !selectedDate || albumTracks.length === 0) {
      toast.error('Please select an album and date');
      return;
    }
    
    // Check for conflict and show confirmation if not replacing
    if (dateConflict && !replaceExisting) {
      setShowReplaceConfirm(true);
      return;
    }
    
    setIsScheduling(true);
    
    try {
      const albumData = convertAlbumToScheduleData(selectedAlbum);
      const tracksData = convertTracksToScheduleData(albumTracks);
      const dateString = formatDateToString(selectedDate);
      
      const result = await scheduleAlbum(albumData, tracksData, dateString, replaceExisting);
      
      if (result.success) {
        onScheduled?.();
        onClose();
      }
    } catch (error) {
      console.error('Error scheduling album:', error);
      toast.error('Failed to schedule album. Please try again.');
    } finally {
      setIsScheduling(false);
      setShowReplaceConfirm(false);
    }
  };
  
  // Disable dates function for calendar
  const isDateDisabled = (date: Date): boolean => {
    const dateString = formatDateToString(date);
    // Disable past dates and weekends
    return isPastDate(dateString) || isWeekend(dateString);
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div 
          className="bg-card rounded-2xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-hidden animate-scale-up flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
            <div className="flex items-center gap-3">
              {currentStep === 'schedule' && (
                <button
                  onClick={handleBackToSearch}
                  className="p-1 rounded-full hover:bg-muted transition-colors"
                  disabled={isScheduling}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <h2 className="text-xl font-semibold">
                {currentStep === 'search' ? 'Schedule Album' : 'Select Date'}
              </h2>
            </div>
            <button 
              onClick={onClose}
              className="p-1 rounded-full hover:bg-muted transition-colors"
              aria-label="Close modal"
              disabled={isScheduling}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {currentStep === 'search' ? (
              // Search view
              <div className="p-5 space-y-4">
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for albums or artists..."
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    autoFocus
                    disabled={isLoadingTracks}
                  />
                </div>
                
                {/* Loading skeleton */}
                {isSearching && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <div key={index} className="bg-muted/30 rounded-lg overflow-hidden">
                        <Skeleton className="w-full h-32 sm:h-36 md:h-40" />
                        <div className="p-2 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Search results grid */}
                {!isSearching && searchResults.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {searchResults.map((album) => (
                      <div
                        key={album.collectionId}
                        className={cn(
                          "group relative bg-muted/30 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02]",
                          isLoadingTracks && "opacity-50 cursor-not-allowed pointer-events-none"
                        )}
                        onClick={() => !isLoadingTracks && handleAlbumSelect(album)}
                      >
                        {/* Cover art */}
                        <div className="relative w-full h-32 sm:h-36 md:h-40 overflow-hidden">
                          <img
                            src={album.artworkUrl600 || album.artworkUrl100}
                            alt={`${album.collectionName} by ${album.artistName}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                            loading="lazy"
                          />
                          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            <Music className="h-3 w-3" />
                            {album.trackCount}
                          </div>
                        </div>
                        
                        {/* Album info */}
                        <div className="p-2">
                          <h3 className="font-semibold text-xs line-clamp-1 mb-0.5">
                            {album.collectionName}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {album.artistName}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Empty state */}
                {!isSearching && searchQuery && searchResults.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Music className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No albums found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Try a different search term
                    </p>
                  </div>
                )}
                
                {/* Initial state */}
                {!isSearching && !searchQuery && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">Search for an album to schedule</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Albums can be scheduled for weekdays (Mon-Fri)
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Schedule view
              <div className="p-5 space-y-6">
                {/* Selected album preview */}
                {selectedAlbum && (
                  <div className="flex gap-4 p-4 bg-muted/30 rounded-lg">
                    <img
                      src={selectedAlbum.artworkUrl600 || selectedAlbum.artworkUrl100}
                      alt={`${selectedAlbum.collectionName} cover`}
                      className="w-24 h-24 rounded-lg shadow-md flex-shrink-0 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg line-clamp-2">
                        {selectedAlbum.collectionName}
                      </h3>
                      <p className="text-muted-foreground mt-1">
                        {selectedAlbum.artistName}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {albumTracks.length} tracks
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Date picker */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Select Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                        disabled={isScheduling}
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
                          "{dateConflict.album_name}" by {dateConflict.artist_name} is currently scheduled for this date.
                          Scheduling a new album will replace it.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Weekend/past date info */}
                  <p className="text-xs text-muted-foreground">
                    Only weekdays (Monday - Friday) are available for scheduling.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer */}
          {currentStep === 'schedule' && (
            <div className="flex items-center justify-end gap-3 p-5 border-t flex-shrink-0">
              <Button
                variant="outline"
                onClick={handleBackToSearch}
                disabled={isScheduling}
              >
                Back
              </Button>
              <Button
                onClick={() => handleSchedule(false)}
                disabled={!selectedDate || isScheduling || isCheckingDate}
              >
                {isScheduling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <CalendarIcon className="h-4 w-4" />
                    Schedule Album
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {/* Replace confirmation dialog */}
      <AlertDialog open={showReplaceConfirm} onOpenChange={setShowReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Scheduled Album?</AlertDialogTitle>
            <AlertDialogDescription>
              "{dateConflict?.album_name}" is already scheduled for this date. 
              Do you want to replace it with "{selectedAlbum?.collectionName}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isScheduling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleSchedule(true)}
              disabled={isScheduling}
              className="bg-primary"
            >
              {isScheduling ? 'Replacing...' : 'Replace Album'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
