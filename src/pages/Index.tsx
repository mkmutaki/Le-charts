import { useState, useEffect, useRef, useCallback } from 'react';
import { useSongStore, useVotingStore, useWeekendStore } from '@/lib/store';
import { Navbar } from '@/components/Navbar';
import { ScheduledSongCard } from '@/components/ScheduledSongCard';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { clearSongsCache } from '@/lib/serviceWorker';
import { useDateCheck } from '@/hooks/useDateCheck';
import { formatScheduledDate } from '@/lib/dateUtils';

const Index = () => {
  const {
    scheduledSongs,
    fetchScheduledSongs,
    isLoading: storeLoading,
    currentAlbum,
    useScheduledAlbums,
  } = useSongStore();
  const { getUserVotedScheduledTrack } = useVotingStore();
  const {
    weekendMode,
    bracketTracks,
    sundayFinalists,
    resolveWeekendMode,
    fetchBracketTracks,
    fetchSundayFinalists,
    fetchWeeklyChampions,
    clearWeekendVotingData,
    isLoadingBracket,
    isLoadingFinalists,
  } = useWeekendStore();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isManualLoading, setIsManualLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const hasFetchedRef = useRef(false);
  const refreshIntervalRef = useRef<number | null>(null);

  const loadDataForDate = useCallback(
    async (date: string, options: { force?: boolean } = {}) => {
      const mode = resolveWeekendMode(date);
      await fetchWeeklyChampions(date, options);

      if (mode === 'weekday') {
        clearWeekendVotingData();
        await fetchScheduledSongs(date, options);
      } else if (mode === 'saturday') {
        await fetchBracketTracks(date, options);
      } else {
        await fetchSundayFinalists(date, options);
      }

      await getUserVotedScheduledTrack(date);
    },
    [
      resolveWeekendMode,
      fetchWeeklyChampions,
      clearWeekendVotingData,
      fetchScheduledSongs,
      fetchBracketTracks,
      fetchSundayFinalists,
      getUserVotedScheduledTrack,
    ]
  );

  const handleDateChange = useCallback(
    async (newDate: string, oldDate: string) => {
      console.log(`Date changed from ${oldDate} to ${newDate}`);
      toast.info('New day detected. Refreshing chart...');
      setIsTransitioning(true);

      try {
        await loadDataForDate(newDate, { force: true });
      } catch (error) {
        console.error('Error handling date change:', error);
        toast.error('Failed to load data for the new day');
      } finally {
        setIsTransitioning(false);
      }
    },
    [loadDataForDate]
  );

  const { currentDate, hasDateChanged, resetDateCheck } = useDateCheck({
    checkInterval: 60000,
    onDateChange: handleDateChange,
  });

  useEffect(() => {
    if (hasDateChanged) {
      resetDateCheck();
    }
  }, [hasDateChanged, resetDateCheck]);

  const handleManualRefresh = async () => {
    try {
      clearSongsCache();
      setIsManualLoading(true);
      await loadDataForDate(currentDate, { force: true });
      toast.success('Song data refreshed');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
    } finally {
      setIsManualLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        clearSongsCache();

        try {
          await loadDataForDate(currentDate, { force: true });
        } finally {
          setIsBootstrapping(false);
          setTimeout(() => setIsPageLoaded(true), 300);
        }
      }
    };

    bootstrap();
  }, [currentDate, loadDataForDate]);

  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    refreshIntervalRef.current = window.setInterval(() => {
      fetchWeeklyChampions(currentDate);

      if (weekendMode === 'weekday') {
        fetchScheduledSongs(currentDate);
      } else if (weekendMode === 'saturday') {
        fetchBracketTracks(currentDate, { force: true });
      } else {
        fetchSundayFinalists(currentDate, { force: true });
      }
    }, 30000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [
    currentDate,
    weekendMode,
    fetchScheduledSongs,
    fetchBracketTracks,
    fetchSundayFinalists,
    fetchWeeklyChampions,
  ]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleEmptyStateAddClick = () => {
    toast.info('Only administrators can add songs. Please login if you are an admin.');
  };

  const displaySongs =
    weekendMode === 'saturday'
      ? bracketTracks
      : weekendMode === 'sunday'
      ? sundayFinalists
      : scheduledSongs;

  const modeLoading =
    weekendMode === 'weekday'
      ? storeLoading
      : weekendMode === 'saturday'
      ? isLoadingBracket
      : isLoadingFinalists;

  const isLoading = isBootstrapping || isManualLoading || modeLoading;

  const title =
    weekendMode === 'weekday'
      ? `Album - ${currentAlbum ? currentAlbum.name : 'No album scheduled'}`
      : weekendMode === 'saturday'
      ? 'Saturday Bracket'
      : 'Sunday Finals';

  const subtitle =
    weekendMode === 'weekday'
      ? useScheduledAlbums && currentAlbum
        ? `Vote for your favorite song • ${formatScheduledDate(currentDate)}`
        : 'Vote for your favorite song'
      : weekendMode === 'saturday'
      ? `Vote for your finalists • ${formatScheduledDate(currentDate)}`
      : `Vote for your weekly champion • ${formatScheduledDate(currentDate)}`;

  const loadingMessage =
    weekendMode === 'weekday'
      ? "Loading today's album..."
      : weekendMode === 'saturday'
      ? "Loading Saturday's bracket..."
      : "Loading Sunday's finalists...";

  return (
    <div
      className={cn(
        'min-h-screen bg-background transition-opacity duration-500',
        isPageLoaded ? 'opacity-100' : 'opacity-0'
      )}
    >
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8 md:mb-12">
          <div className="flex flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className=" text-3xl md:text-4xl font-bold mb-5">{title}</h2>
              <div className="flex flex-row justify-between text-muted-foreground mt-2 md:space-x-[307px]">
                <p className="text-start ml-1">{subtitle}</p>
              </div>
            </div>

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
                className={`mr-1 ${isLoading || isTransitioning ? 'animate-spin' : ''}`}
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              {isTransitioning
                ? 'Loading new day...'
                : isLoading
                ? 'Loading...'
                : 'Refresh'}
            </button>
          </div>

          {isLoading || isTransitioning ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              {(isTransitioning || isLoading) && (
                <p className="text-sm text-muted-foreground">{loadingMessage}</p>
              )}
            </div>
          ) : displaySongs.length > 0 ? (
            <div className="space-y-3 md:space-y-4">
              {displaySongs.map((song, index) => (
                <ScheduledSongCard key={song.id} song={song} rank={index + 1} />
              ))}
            </div>
          ) : (
            <EmptyState
              variant={
                weekendMode === 'weekday'
                  ? useScheduledAlbums
                    ? 'no-scheduled-album'
                    : 'default'
                  : 'weekend-empty'
              }
              scheduledDate={currentDate}
              onAddClick={handleEmptyStateAddClick}
            />
          )}
        </div>
      </main>

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={cn(
          'fixed bottom-6 right-6 p-3 rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/30',
          isScrolled
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-10 pointer-events-none'
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
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>

      <div
        id="offline-notification"
        className="fixed bottom-6 left-6 bg-orange-500 text-white px-4 py-2 rounded-md shadow-lg transform translate-y-20 opacity-0 transition-all duration-300"
        style={{ display: 'none' }}
      >
        You're offline. Some features may be limited.
      </div>
    </div>
  );
};

export default Index;
