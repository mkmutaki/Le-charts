import { useState, useEffect, useRef } from 'react';
import { useSongStore, useVotingStore } from '@/lib/store';
import { Navbar } from '@/components/Navbar';
import { SongCard } from '@/components/SongCard';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Index = () => {
  const { songs, fetchSongs, isLoading: storeLoading } = useSongStore();
  const { getUserVotedSong } = useVotingStore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const hasFetchedRef = useRef(false);
  const hasCheckedVotesRef = useRef(false);
  const refreshIntervalRef = useRef<number | null>(null);
  
  // Songs are already sorted by votes and then by updated_at in the fetchSongs function
  const sortedSongs = songs;
  
  useEffect(() => {
    // Set loading from store state
    setIsLoading(storeLoading);
    
    // Only fetch if not already loaded in store
    const loadData = async () => {
      if (songs.length === 0 && !hasFetchedRef.current) {
        hasFetchedRef.current = true;
        await fetchSongs();
      } else {
        // If we already have songs, just update loading state
        setIsLoading(false);
      }
      
      // Check for user votes once
      if (!hasCheckedVotesRef.current) {
        hasCheckedVotesRef.current = true;
        await getUserVotedSong();
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
        fetchSongs();
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
  }, [fetchSongs, getUserVotedSong, songs.length, storeLoading]);
  
  // Handle empty state add button - redirect to login since only admins can add songs
  const handleEmptyStateAddClick = () => {
    toast.info("Only administrators can add songs. Please login if you are an admin.");
    // Option: navigate to login
    // window.location.href = '/login';
  };
  
  return (
    <div className={cn(
      "min-h-screen transition-opacity duration-500",
      isPageLoaded ? "opacity-100" : "opacity-0"
    )}>
      <Navbar />
      
      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8 md:mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className=" text-3xl md:text-4xl font-bold mb-5">
                Top 10 LeSongs
              </h2>
              <div className='flex flex-col md:flex-row justify-between text-muted-foreground mt-2 md:space-x-[407px]'>
                <p className="text-start ml-1">Vote for your favorite</p>
                <p className='text-sm'>*Songs updated weekly</p>
              </div>
            </div>
          </div>
          
          {/* Songs list */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sortedSongs.length > 0 ? (
            <div className="space-y-3 md:space-y-4">
              {sortedSongs.map((song, index) => (
                <SongCard 
                  key={song.id} 
                  song={song} 
                  rank={index + 1} 
                />
              ))}
            </div>
          ) : (
            <EmptyState onAddClick={handleEmptyStateAddClick} />
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
    </div>
  );
};

export default Index;
