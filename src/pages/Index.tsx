
import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSongStore, useAuthStore, useVotingStore } from '@/lib/store';
import { SongCard } from '@/components/SongCard';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';

const Index = () => {
  const { songs, fetchSongs } = useSongStore();
  const { currentUser, checkIsAdmin } = useAuthStore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = checkIsAdmin();
  
  // Songs are already sorted by votes and then by updated_at in the fetchSongs function
  const sortedSongs = songs;
  
  useEffect(() => {
    // Load songs when the component mounts
    const loadData = async () => {
      await fetchSongs();
      setIsLoading(false);
      
      // Set page as loaded after a short delay to allow for animation
      setTimeout(() => {
        setIsPageLoaded(true);
      }, 300);
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
  
  return (
    <div className={cn(
      "min-h-screen transition-opacity duration-500",
      isPageLoaded ? "opacity-100" : "opacity-0"
    )}>
      <header className="fixed top-0 left-0 right-0 z-50 py-4 px-4 md:px-8 transition-all duration-300 glass-effect shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="h-6 w-6 text-primary"
            >
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            <h1 className="text-xl font-semibold tracking-tight">
              MusicChart
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-amber-100 text-amber-800"
              >
                <Shield className="h-3.5 w-3.5" />
                Admin Dashboard
              </Link>
            )}
          </div>
        </div>
      </header>
      
      <div className="h-16" /> {/* Spacer for fixed header */}
      
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
            <EmptyState onAddClick={() => null} />
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
