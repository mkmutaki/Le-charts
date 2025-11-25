import { useState, useEffect, useCallback } from 'react';
import { X, Search, Loader2, Music, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSongStore } from '@/lib/store';
import { toast } from 'sonner';
import { searchAlbums, getAlbumTracks, ITunesAlbum, ITunesTrack } from '@/lib/services/spotifyService';
import { Badge } from '@/components/ui/badge';

interface AlbumSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAlbumUploaded: () => void;
}

export const AlbumSearchModal = ({ isOpen, onClose, onAlbumUploaded }: AlbumSearchModalProps) => {
  const { addAlbumTracks, checkExistingTracks, setCurrentAlbum } = useSongStore();
  
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ITunesAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<ITunesAlbum | null>(null);
  const [albumTracks, setAlbumTracks] = useState<ITunesTrack[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(new Set());
  const [existingTrackIds, setExistingTrackIds] = useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
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
        toast.error('Failed to search albums');
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
    }
  }, [isOpen]);
  
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
    setSelectedAlbum(album);
    setIsLoadingTracks(true);
    
    try {
      const tracks = await getAlbumTracks(album.collectionId);
      setAlbumTracks(tracks);
      
      // Check which tracks already exist in the database
      const trackIdsToCheck = tracks.map(track => String(track.trackId));
      const existingIds = await checkExistingTracks(trackIdsToCheck);
      setExistingTrackIds(existingIds);
      
      // Select all non-existing tracks by default
      const nonExistingTrackIds = new Set(
        tracks
          .filter(track => !existingIds.has(String(track.trackId)))
          .map(track => track.trackId)
      );
      setSelectedTrackIds(nonExistingTrackIds);
    } catch (error) {
      console.error('Error loading tracks:', error);
      toast.error('Failed to load album tracks');
      setSelectedAlbum(null);
    } finally {
      setIsLoadingTracks(false);
    }
  };
  
  const handleTrackToggle = (trackId: number) => {
    // Don't allow toggling tracks that already exist
    if (existingTrackIds.has(String(trackId))) {
      return;
    }
    
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
    if (!selectedAlbum || selectedTrackIds.size === 0) return;
    
    setIsUploading(true);
    const selectedTracks = albumTracks.filter(track => selectedTrackIds.has(track.trackId));
    
    try {
      // Set the current album in the store before uploading tracks
      setCurrentAlbum({
        name: selectedAlbum.collectionName,
        artist: selectedAlbum.artistName
      });
      
      // Prepare track data with iTunes track IDs
      const tracksToUpload = selectedTracks.map(track => ({
        title: track.trackName,
        artist: track.artistName,
        coverUrl: track.artworkUrl600 || track.artworkUrl100,
        songUrl: track.trackViewUrl,
        itunesTrackId: String(track.trackId),
        albumName: track.collectionName,
        trackNumber: track.trackNumber,
        trackDurationMs: track.trackTimeMillis,
      }));
      
      // Use the new batch upload function
      const result = await addAlbumTracks(tracksToUpload);
      
      if (result.added > 0) {
        onAlbumUploaded();
        onClose();
      }
    } catch (error) {
      console.error('Error uploading tracks:', error);
      toast.error('Failed to upload tracks');
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleBackToSearch = () => {
    setSelectedAlbum(null);
    setAlbumTracks([]);
    setSelectedTrackIds(new Set());
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
                />
              </div>
              
              {/* Loading spinner */}
              {isSearching && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              
              {/* Search results grid */}
              {!isSearching && searchResults.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {searchResults.map((album) => (
                    <div
                      key={album.collectionId}
                      className="group relative bg-muted/30 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
                      onClick={() => handleAlbumSelect(album)}
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
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              
              {/* Track list */}
              {!isLoadingTracks && albumTracks.length > 0 && (
                <>
                  {/* Warning if all tracks exist */}
                  {existingTrackIds.size === albumTracks.length && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          All tracks already exist
                        </p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                          All tracks from this album are already in the chart.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {selectedTrackIds.size} of {albumTracks.length - existingTrackIds.size} new tracks selected
                      {existingTrackIds.size > 0 && (
                        <span className="text-muted-foreground ml-1">
                          ({existingTrackIds.size} already in chart)
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const nonExistingTrackIds = albumTracks
                            .filter(track => !existingTrackIds.has(String(track.trackId)))
                            .map(t => t.trackId);
                          setSelectedTrackIds(new Set(nonExistingTrackIds));
                        }}
                        className="text-xs text-primary hover:underline"
                        disabled={isUploading || existingTrackIds.size === albumTracks.length}
                      >
                        Select All New
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
                      const isExisting = existingTrackIds.has(String(track.trackId));
                      const isSelected = selectedTrackIds.has(track.trackId);
                      const duration = Math.floor(track.trackTimeMillis / 1000);
                      const minutes = Math.floor(duration / 60);
                      const seconds = duration % 60;
                      
                      return (
                        <label
                          key={track.trackId}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg transition-all",
                            isExisting && "opacity-50 cursor-not-allowed",
                            !isExisting && "cursor-pointer",
                            !isExisting && isSelected && "bg-primary/10 hover:bg-primary/15",
                            !isExisting && !isSelected && "bg-muted/30 hover:bg-muted/50",
                            isUploading && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleTrackToggle(track.trackId)}
                            disabled={isUploading || isExisting}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30 disabled:cursor-not-allowed"
                          />
                          <div className="flex-shrink-0 w-6 text-sm text-muted-foreground text-center">
                            {track.trackNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "font-medium text-sm truncate",
                              isExisting && "line-through"
                            )}>
                              {track.trackName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {track.artistName}
                            </p>
                          </div>
                          <div className="flex-shrink-0 text-xs text-muted-foreground">
                            {minutes}:{seconds.toString().padStart(2, '0')}
                          </div>
                          {isExisting && (
                            <Badge variant="secondary" className="flex-shrink-0">
                              Already in chart
                            </Badge>
                          )}
                          {!isExisting && isSelected && (
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
            <button
              onClick={handleUploadTracks}
              disabled={selectedTrackIds.size === 0 || isUploading}
              className={cn(
                "w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2",
                (selectedTrackIds.size === 0 || isUploading) && "opacity-70 cursor-not-allowed"
              )}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Uploading Tracks...
                </>
              ) : (
                `Upload ${selectedTrackIds.size} Selected Track${selectedTrackIds.size !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
