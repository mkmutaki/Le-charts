
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSongStore, useVotingStore } from '@/lib/store';
import { Navbar } from '@/components/Navbar';
import { SongCard } from '@/components/SongCard';
import { ScheduledSongCard } from '@/components/ScheduledSongCard';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { clearSongsCache } from '@/lib/serviceWorker';
import { useDateCheck } from '@/hooks/useDateCheck';
import { formatScheduledDate } from '@/lib/dateUtils';
import { updatePuzzleSettingsFromScheduledAlbum, syncPuzzleSettingsToCurrentDate } from '@/hooks/usePuzzleSettings';

const Index = () => {
  const { 
    songs, 
    scheduledSongs,
    fetchSongs, 
    fetchScheduledSongs,
    isLoading: storeLoading, 
    currentAlbum,
    useScheduledAlbums
  } = useSongStore();
  const { getUserVotedSong, getUserVotedScheduledTrack } = useVotingStore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const hasFetchedRef = useRef(false);
  const hasCheckedVotesRef = useRef(false);
  const refreshIntervalRef = useRef<number | null>(null);
  
  // Date check hook - detects midnight transition
  const { currentDate, hasDateChanged, resetDateCheck } = useDateCheck({
    checkInterval: 60000, // Check every minute
    onDateChange: async (newDate, oldDate) => {
      console.log(`Date changed from ${oldDate} to ${newDate}`);
      toast.info('New day! Loading today\'s album...');
      
      // Show transition state
      setIsTransitioning(true);
      
      // Fetch the new day's scheduled album
      await handleDateChange(newDate);
      
      setIsTransitioning(false);
    },
  });
  
  // Handle date change - fetch new album and update puzzle
  const handleDateChange = useCallback(async (date: string) => {
    try {
      // Reset vote check ref since it's a new day
      hasCheckedVotesRef.current = false;
      
      // Fetch scheduled songs for the new date
      const songs = await fetchScheduledSongs(date, { force: true });
      
      // Sync puzzle settings to current date via database function
      // This ensures puzzle_settings is updated to today's scheduled album
      const syncResult = await syncPuzzleSettingsToCurrentDate();
      console.log('Puzzle settings sync result:', syncResult);
      
      // Also update puzzle settings locally if we have an album
      if (songs.length > 0 && currentAlbum) {
        await updatePuzzleSettingsFromScheduledAlbum(
          songs[0].artworkUrl || '',
          currentAlbum.name,
          currentAlbum.artist
        );
      }
      
      // Check user's vote status for this date
      await getUserVotedScheduledTrack(date);
      
    } catch (error) {
      console.error('Error handling date change:', error);
      toast.error('Failed to load today\'s album');
    }
  }, [fetchScheduledSongs, currentAlbum, getUserVotedScheduledTrack]);
  
  // Reset date change flag after handling
  useEffect(() => {
    if (hasDateChanged) {
      resetDateCheck();
    }
  }, [hasDateChanged, resetDateCheck]);
  
  // Determine which songs to display based on mode
  const displaySongs = useScheduledAlbums ? scheduledSongs : songs;
  
  // Function to handle manual refresh
  const handleManualRefresh = async () => {
    try {
      // Clear the service worker cache for songs
      clearSongsCache();
      
      // Show loading state
      setIsLoading(true);
      
      // Fetch fresh data based on mode
      if (useScheduledAlbums) {
        await fetchScheduledSongs(currentDate, { force: true });
        await getUserVotedScheduledTrack(currentDate);
      } else {
        await fetchSongs({ force: true });
        await getUserVotedSong();
      }
      
      toast.success('Song data refreshed');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    // Set loading from store state
    setIsLoading(storeLoading);
    
    // Only fetch if not already loaded in store
    const loadData = async () => {
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        
        if (useScheduledAlbums) {
          // Fetch today's scheduled album
          const songs = await fetchScheduledSongs(currentDate);
          
          // Sync puzzle settings to current date on app load
          const syncResult = await syncPuzzleSettingsToCurrentDate();
          console.log('Initial puzzle settings sync result:', syncResult);
          
          // Update puzzle settings if we have an album
          if (songs.length > 0) {
            const albumInfo = useSongStore.getState().currentAlbum;
            if (albumInfo && songs[0].artworkUrl) {
              await updatePuzzleSettingsFromScheduledAlbum(
                songs[0].artworkUrl,
                albumInfo.name,
                albumInfo.artist
              );
            }
          }
        } else {
          await fetchSongs();
        }
      } else {
        // If we already have songs, just update loading state
        setIsLoading(false);
      }
      
      // Check for user votes once
      if (!hasCheckedVotesRef.current) {
        hasCheckedVotesRef.current = true;
        if (useScheduledAlbums) {
          await getUserVotedScheduledTrack(currentDate);
        } else {
          await getUserVotedSong();
        }
      }
      
      // Set page as loaded after a short delay to allow for animation
      setTimeout(() => {
        setIsPageLoaded(true);
      }, 300);
    };
    
    loadData();
    
    // Set up regular refresh interval to keep vote counts in sync across devices
    if (!refreshIntervalRef.current) {
      refreshIntervalRef.current = window.setInterval(() => {
        if (useScheduledAlbums) {
          fetchScheduledSongs(currentDate);
        } else {
          fetchSongs();
        }
      }, 30000); // Refresh every 30 seconds
    }
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [fetchSongs, fetchScheduledSongs, getUserVotedSong, getUserVotedScheduledTrack, storeLoading, useScheduledAlbums, currentDate]);
  
  // Handle empty state add button - redirect to login since only admins can add songs
  const handleEmptyStateAddClick = () => {
    toast.info("Only administrators can add songs. Please login if you are an admin.");
    // Option: navigate to login
    // window.location.href = '/login';
  };
  
  return (
    <div className={cn(
      "min-h-screen bg-background transition-opacity duration-500",
      isPageLoaded ? "opacity-100" : "opacity-0"
    )}>
      <Navbar />
      
      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8 md:mb-12">
          <div className="flex flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className=" text-3xl md:text-4xl font-bold mb-5">
                Album - {currentAlbum ? currentAlbum.name : 'No album scheduled'}
              </h2>
              <div className='flex flex-row justify-between text-muted-foreground mt-2 md:space-x-[307px]'>
                <p className="text-start ml-1">
                  {useScheduledAlbums && currentAlbum ? (
                    <>Vote for your favorite song • {formatScheduledDate(currentDate)}</>
                  ) : (
                    'Vote for your favorite song'
                  )}
                </p>
              </div>
            </div>
            
            {/* Manual refresh button */}
            <button
              onClick={handleManualRefresh}
              className="text-sm text-primary flex items-center"
              aria-label="Refresh songs data"
              disabled={isLoading || isTransitioning}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none"
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className={`mr-1 ${(isLoading || isTransitioning) ? 'animate-spin' : ''}`}
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              {isTransitioning ? 'Loading new day...' : isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {/* Songs list */}
          {(isLoading || isTransitioning) ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              {isTransitioning && (
                <p className="text-sm text-muted-foreground">Loading today's album...</p>
              )}
            </div>
          ) : displaySongs.length > 0 ? (
            <div className="space-y-3 md:space-y-4">
              {useScheduledAlbums ? (
                // Render ScheduledSongCard for scheduled albums
                scheduledSongs.map((song, index) => (
                  <ScheduledSongCard 
                    key={song.id} 
                    song={song} 
                    rank={index + 1} 
                  />
                ))
              ) : (
                // Render SongCard for legacy songs
                songs.map((song, index) => (
                  <SongCard 
                    key={song.id} 
                    song={song} 
                    rank={index + 1} 
                  />
                ))
              )}
            </div>
          ) : (
            <EmptyState 
              variant={useScheduledAlbums ? 'no-scheduled-album' : 'default'}
              scheduledDate={currentDate}
              onAddClick={handleEmptyStateAddClick}
            />
          )}
        </div>
      </main>
      
      {/* Back to top button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={cn(
          "fixed bottom-6 right-6 p-3 rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/30",
          isScrolled ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
        )}
        aria-label="Back to top"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="m18 15-6-6-6 6"/>
        </svg>
      </button>
      
      {/* Offline notification */}
      <div id="offline-notification" className="fixed bottom-6 left-6 bg-orange-500 text-white px-4 py-2 rounded-md shadow-lg transform translate-y-20 opacity-0 transition-all duration-300" style={{ display: 'none' }}>
        You're offline. Some features may be limited.
      </div>
    </div>
  );
};

export default Index;
