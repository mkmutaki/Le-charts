
import { useState, useEffect } from 'react';
import { useSongStore } from '@/lib/store';
import { Navbar } from '@/components/Navbar';
import { SongCard } from '@/components/SongCard';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const Index = () => {
  console.log('Index component rendering');
  const { songs, fetchSongs } = useSongStore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Songs are already sorted by votes and then by updated_at in the fetchSongs function
  const sortedSongs = songs;
  
  useEffect(() => {
    console.log('Index useEffect running');
    // Load songs when the component mounts
    const loadData = async () => {
      try {
        setError(null);
        await fetchSongs();
        setIsLoading(false);
        
        // Set page as loaded after a short delay to allow for animation
        setTimeout(() => {
          setIsPageLoaded(true);
        }, 300);
      } catch (err) {
        console.error('Error loading songs:', err);
        setError('Failed to load songs. Please try again.');
        setIsLoading(false);
      }
    };
    
    loadData();
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [fetchSongs]);
  
  // Handle empty state add button - redirect to login since only admins can add songs
  const handleEmptyStateAddClick = () => {
    toast.info("Only administrators can add songs. Please login if you are an admin.");
    // Option: navigate to login
    // window.location.href = '/login';
  };

  const handleRetry = async () => {
    setIsLoading(true);
    try {
      await fetchSongs();
      setError(null);
    } catch (err) {
      setError('Failed to load songs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className={cn(
      "min-h-screen bg-background text-foreground transition-opacity duration-500",
      isPageLoaded ? "opacity-100" : "opacity-0"
    )}>
      <Navbar />
      
      <main className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="mb-8 md:mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold">
                Top Charts
              </h2>
              <p className="text-muted-foreground mt-2">
                Vote for your favorite LeSongs
              </p>
            </div>
          </div>
          
          {/* Songs list */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <button 
                onClick={handleRetry}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Retry
              </button>
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
