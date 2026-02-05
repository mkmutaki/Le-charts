import { useState, useEffect, useCallback } from 'react';
import { X, Search, Loader2, Music, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSongStore, useVotingStore, useScheduleStore } from '@/lib/store';
import { toast } from 'sonner';
import { searchAlbums, getAlbumTracks, ITunesAlbum, ITunesTrack } from '@/lib/services/spotifyService';
import { 
  convertAlbumToScheduleData, 
  convertTracksToScheduleData,
  checkDateAvailability 
} from '@/lib/services/scheduledAlbumService';
import { getLocalDateString } from '@/lib/dateUtils';
import { updatePuzzleSettingsFromAlbum } from '@/hooks/usePuzzleSettings';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

interface AlbumSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAlbumUploaded: () => void;
}

export const AlbumSearchModal = ({ isOpen, onClose, onAlbumUploaded }: AlbumSearchModalProps) => {
  const { setCurrentAlbum, currentUser, checkIsAdmin, fetchScheduledSongs } = useSongStore();
  const { scheduleAlbum, fetchScheduledAlbums } = useScheduleStore();
  
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ITunesAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<ITunesAlbum | null>(null);
  const [albumTracks, setAlbumTracks] = useState<ITunesTrack[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(new Set());
  const [existingTrackIds, setExistingTrackIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isUploading, setIsUploading] = useState(false)
  const [failedTrackIds, setFailedTrackIds] = useState<Set<number>>(new Set());
  const [uploadAttempted, setUploadAttempted] = useState(false);
  const [showLargeAlbumConfirm, setShowLargeAlbumConfirm] = useState(false);
  const [uploadCancelled, setUploadCancelled] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [existingSongsCount, setExistingSongsCount] = useState(0);
  const [largeAlbumConfirmed, setLargeAlbumConfirmed] = useState(false);
  
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
        setSearchResults(results.slice(0, 200)); 
      } catch (error) {
        console.error('Search error:', error);
        // Show user-friendly error message
        if (error instanceof Error) {
          toast.error(error.message);
        } else {
          toast.error('Failed to search albums. Please try again.');
        }
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce delay
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedAlbum(null);
      setAlbumTracks([]);
      setSelectedTrackIds(new Set());
      setExistingTrackIds(new Set());
      setFailedTrackIds(new Set());
      setUploadAttempted(false);
      setUploadCancelled(false);
      setShowLargeAlbumConfirm(false);
      setShowReplaceConfirm(false);
      setExistingSongsCount(0);
      setLargeAlbumConfirmed(false);
    }
  }, [isOpen]);

  // Verify admin status when modal opens
  useEffect(() => {
    if (isOpen && !checkIsAdmin()) {
      toast.error('Only admins can upload albums');
      onClose();
    }
  }, [isOpen, checkIsAdmin, onClose]);
  
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isUploading) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isUploading, onClose]);
  
  const handleAlbumSelect = async (album: ITunesAlbum) => {
    // Validate album art URL
    if (!album.artworkUrl600 && !album.artworkUrl100) {
      toast.error('This album is missing artwork and cannot be uploaded');
      return;
    }

    // Validate album art URL format
    try {
      const artworkUrl = album.artworkUrl600 || album.artworkUrl100;
      const url = new URL(artworkUrl);
      if (!url.protocol.startsWith('http')) {
        throw new Error('Invalid URL protocol');
      }
    } catch (error) {
      toast.error('This album has an invalid artwork URL and cannot be uploaded');
      return;
    }

    setSelectedAlbum(album);
    setIsLoadingTracks(true);
    
    try {
      const tracks = await getAlbumTracks(album.collectionId);
      
      // Validate we got tracks back
      if (!tracks || tracks.length === 0) {
        toast.error('This album has no tracks and cannot be uploaded');
        setSelectedAlbum(null);
        return;
      }
      
      setAlbumTracks(tracks);
      
      // Select all tracks by default (no need to check existing since we're replacing)
      const allTrackIds = new Set(tracks.map(track => track.trackId));
      setSelectedTrackIds(allTrackIds);
      
      // Clear existing track IDs since we're doing a full replacement
      setExistingTrackIds(new Set());
    } catch (error) {
      console.error('Error loading tracks:', error);
      // Show user-friendly error message
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
  
  const handleTrackToggle = (trackId: number) => {
    setSelectedTrackIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trackId)) {
        newSet.delete(trackId);
      } else {
        newSet.add(trackId);
      }
      return newSet;
    });
  };
  
  const handleUploadTracks = async () => {
    if (!selectedAlbum || selectedTrackIds.size === 0) {
      toast.error('Please select at least one track to upload');
      return;
    }
    
    const today = getLocalDateString();
    
    // Check for large album and show confirmation
    if (selectedTrackIds.size > 20 && !largeAlbumConfirmed) {
      // Check if there's an existing album scheduled for today
      const existingAlbum = await checkDateAvailability(today);
      setExistingSongsCount(existingAlbum ? existingAlbum.track_count : 0);
      setShowLargeAlbumConfirm(true);
      return;
    }
    
    // Check if there's an existing album scheduled for today
    const existingAlbum = await checkDateAvailability(today);
    if (existingAlbum && !uploadAttempted) {
      setExistingSongsCount(existingAlbum.track_count);
      setShowReplaceConfirm(true);
      return;
    }
    
    setIsUploading(true);
    setUploadCancelled(false);
    const selectedTracks = albumTracks.filter(track => selectedTrackIds.has(track.trackId));
    
    try {
      // Set the current album in the store
      setCurrentAlbum({
        name: selectedAlbum.collectionName,
        artist: selectedAlbum.artistName
      });
      
      // Check if cancelled
      if (uploadCancelled) {
        toast.info('Upload cancelled');
        return;
      }
      
      // Convert to schedule data format
      const albumData = convertAlbumToScheduleData(selectedAlbum);
      // Override track count with selected tracks count
      albumData.trackCount = selectedTracks.length;
      
      const trackData = convertTracksToScheduleData(selectedTracks);
      
      // Schedule the album for today (this will replace any existing album)
      const result = await scheduleAlbum(albumData, trackData, today, true);
      
      // Check if cancelled after upload
      if (uploadCancelled) {
        toast.info('Upload cancelled');
        return;
      }
      
      if (!result.success) {
        toast.error(result.error || 'Failed to upload album');
        return;
      }
      
      setUploadAttempted(true);
      
      // Update puzzle settings with the new album cover
      await updatePuzzleSettingsFromAlbum(
        selectedAlbum.artworkUrl600 || selectedAlbum.artworkUrl100,
        selectedAlbum.collectionName,
        selectedAlbum.artistName
      );
      
      // Clear voting state for new album
      useVotingStore.setState({ 
        votedScheduledTrackId: null,
        currentVoteDate: today 
      });
      
      // Refresh scheduled albums list and scheduled songs
      await Promise.all([
        fetchScheduledAlbums(),
        fetchScheduledSongs(today, { force: true })
      ]);
      
      toast.success(`Album uploaded! ${selectedTracks.length} track${selectedTracks.length !== 1 ? 's' : ''} added for today`);
      onAlbumUploaded();
      onClose();
      
    } catch (error) {
      console.error('Error uploading tracks:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to upload tracks. Please try again.');
      }
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleBackToSearch = () => {
    setSelectedAlbum(null);
    setAlbumTracks([]);
    setSelectedTrackIds(new Set());
  };

  const handleCancelUpload = () => {
    setUploadCancelled(true);
    toast.info('Cancelling upload...');
  };

  const confirmLargeAlbumUpload = async () => {
    setShowLargeAlbumConfirm(false);
    setLargeAlbumConfirmed(true);
    
    // Check if there's an existing album scheduled for today
    const today = getLocalDateString();
    const existingAlbum = await checkDateAvailability(today);
    
    // Check if we need to show the replacement dialog next
    if (existingAlbum && !uploadAttempted) {
      setExistingSongsCount(existingAlbum.track_count);
      setShowReplaceConfirm(true);
      return;
    }
    
    // No existing album, proceed directly to upload
    handleUploadTracks();
  };
  
  const confirmReplaceAlbum = () => {
    setShowReplaceConfirm(false);
    setUploadAttempted(true); // Mark as attempted to skip this check on retry
    // Re-trigger upload
    handleUploadTracks();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div 
        className="bg-card rounded-2xl shadow-lg w-full max-w-3xl max-h-[90vh] overflow-hidden animate-scale-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
          <h2 className="text-xl font-semibold">
            {selectedAlbum ? 'Select Tracks' : 'Search Albums'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors"
            aria-label="Close modal"
            disabled={isUploading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!selectedAlbum ? (
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
                  disabled={isUploading || isLoadingTracks}
                />
              </div>
              
              {/* Loading spinner */}
              {isSearching && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="bg-muted/30 rounded-lg overflow-hidden">
                      <Skeleton className="w-full h-32 sm:h-36 md:h-40" />
                      <div className="p-2 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-8 w-full" />
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
                        (isUploading || isLoadingTracks) && "opacity-50 cursor-not-allowed pointer-events-none"
                      )}
                      onClick={() => !isUploading && !isLoadingTracks && handleAlbumSelect(album)}
                    >
                      {/* Cover art */}
                      <div className="relative w-full h-32 sm:h-36 md:h-40 overflow-hidden">
                        <img
                          src={album.artworkUrl600}
                          alt={`${album.collectionName} by ${album.artistName}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          loading="lazy"
                        />
                        {/* Track count badge */}
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
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                          {album.artistName}
                        </p>
                        <button
                          className="w-full bg-primary text-primary-foreground py-1.5 rounded-md text-xs font-medium hover:opacity-90 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAlbumSelect(album);
                          }}
                        >
                          Select
                        </button>
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
                  <Search className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Search for an album to get started</p>
                </div>
              )}
            </div>
          ) : (
            // Selected album view
            <div className="p-5 space-y-4">
              {/* Album header */}
              <div className="flex gap-3 pb-4 border-b">
                <img
                  src={selectedAlbum.artworkUrl600}
                  alt={`${selectedAlbum.collectionName} cover`}
                  className="w-20 h-20 rounded-lg shadow-md flex-shrink-0 object-cover"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base line-clamp-2">
                    {selectedAlbum.collectionName}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedAlbum.artistName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedAlbum.trackCount} tracks • {selectedAlbum.primaryGenreName}
                  </p>
                  <button
                    onClick={handleBackToSearch}
                    className="mt-2 text-sm text-primary hover:underline"
                    disabled={isUploading}
                  >
                    ← Back to search
                  </button>
                </div>
              </div>
              
              {/* Loading tracks */}
              {isLoadingTracks && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  {Array.from({ length: 10 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-4 w-6" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                      <Skeleton className="h-4 w-12" />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Track list */}
              {!isLoadingTracks && albumTracks.length > 0 && (
                <>
                  {/* Warning if there are failed tracks */}
                  {failedTrackIds.size > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                          {failedTrackIds.size} track{failedTrackIds.size !== 1 ? 's' : ''} failed to upload
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                          Select the failed tracks and click "Retry" to try uploading them again.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {selectedTrackIds.size} of {albumTracks.length} tracks selected
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const allTrackIds = albumTracks.map(t => t.trackId);
                          setSelectedTrackIds(new Set(allTrackIds));
                        }}
                        className="text-xs text-primary hover:underline"
                        disabled={isUploading}
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => setSelectedTrackIds(new Set())}
                        className="text-xs text-primary hover:underline"
                        disabled={isUploading}
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {albumTracks.map((track) => {
                      const isFailed = failedTrackIds.has(track.trackId);
                      const isSelected = selectedTrackIds.has(track.trackId);
                      const duration = Math.floor(track.trackTimeMillis / 1000);
                      const minutes = Math.floor(duration / 60);
                      const seconds = duration % 60;
                      
                      return (
                        <label
                          key={track.trackId}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer",
                            isFailed && "border-2 border-red-500/50 bg-red-500/5",
                            !isFailed && isSelected && "bg-primary/10 hover:bg-primary/15",
                            !isFailed && !isSelected && "bg-muted/30 hover:bg-muted/50",
                            isUploading && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleTrackToggle(track.trackId)}
                            disabled={isUploading}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30 disabled:cursor-not-allowed"
                          />
                          <div className="flex-shrink-0 w-6 text-sm text-muted-foreground text-center">
                            {track.trackNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {track.trackName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {track.artistName}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-xs text-muted-foreground">
                            {minutes}:{seconds.toString().padStart(2, '0')}
                          </div>
                          {isFailed && (
                            <Badge variant="destructive" className="flex-shrink-0">
                              Failed - Retry
                            </Badge>
                          )}
                          {!isFailed && isSelected && (
                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
              
              {/* No tracks found */}
              {!isLoadingTracks && albumTracks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Music className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No tracks found for this album</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer - Upload button */}
        {selectedAlbum && !isLoadingTracks && albumTracks.length > 0 && (
          <div className="p-5 border-t flex-shrink-0">
            {isUploading ? (
              <div className="flex gap-2">
                <button
                  disabled
                  className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-medium shadow-sm opacity-70 cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Uploading Tracks...
                </button>
                <button
                  onClick={handleCancelUpload}
                  className="px-6 bg-destructive text-destructive-foreground py-3 rounded-lg font-medium shadow-sm hover:opacity-90 transition-all"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleUploadTracks}
                disabled={selectedTrackIds.size === 0}
                className={cn(
                  "w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2",
                  selectedTrackIds.size === 0 && "opacity-70 cursor-not-allowed"
                )}
              >
                {uploadAttempted && failedTrackIds.size > 0 ? (
                  `Retry ${selectedTrackIds.size} Failed Track${selectedTrackIds.size !== 1 ? 's' : ''}`
                ) : (
                  `Upload ${selectedTrackIds.size} Selected Track${selectedTrackIds.size !== 1 ? 's' : ''}`
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Large Album Confirmation Dialog */}
      <AlertDialog open={showLargeAlbumConfirm} onOpenChange={setShowLargeAlbumConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Upload Large Album?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to upload {selectedTrackIds.size} tracks. This may take a few moments.
              Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLargeAlbumUpload}>
              Continue Upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Album Replacement Confirmation Dialog */}
      <AlertDialog open={showReplaceConfirm} onOpenChange={setShowReplaceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
              Replace Today's Album?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                There is already an album scheduled for today with <strong>{existingSongsCount} track{existingSongsCount !== 1 ? 's' : ''}</strong>.
              </p>
              <p>
                Uploading <strong>"{selectedAlbum?.collectionName}"</strong> by <strong>{selectedAlbum?.artistName}</strong> will <span className="text-destructive font-semibold">replace today's album</span> with {selectedTrackIds.size} new track{selectedTrackIds.size !== 1 ? 's' : ''}.
              </p>
              <p className="text-muted-foreground text-sm">
                All votes for today will be cleared. Do you want to continue?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmReplaceAlbum}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Replace Album
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
