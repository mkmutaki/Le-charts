
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSongStore } from '@/lib/store';
import { Navbar } from '@/components/Navbar';
import { SongCard } from '@/components/SongCard';
import { AddSongModal } from '@/components/AddSongModal';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';

const Index = () => {
  const { songs, resetVotes, checkIsAdmin, fetchSongs } = useSongStore();
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = checkIsAdmin();
  
  // Sort songs by votes (descending)
  const sortedSongs = [...songs].sort((a, b) => b.votes - a.votes);
  
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
  
  const handleResetVotes = () => {
    if (window.confirm('Are you sure you want to reset all votes? This cannot be undone.')) {
      resetVotes();
    }
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
              <h2 className="text-3xl md:text-4xl font-bold">
                Top Charts
              </h2>
              <p className="text-muted-foreground mt-2">
                Vote for your favorite LeSongs
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {isAdmin && songs.length > 0 && (
                <button
                  onClick={handleResetVotes}
                  className="flex items-center gap-1.5 bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reset Votes</span>
                </button>
              )}
              
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 bg-muted/50 text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                >
                  <Shield className="h-4 w-4" />
                  <span>Admin</span>
                </Link>
              )}
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
            <EmptyState onAddClick={() => isAdmin ? setIsAddSongOpen(true) : null} />
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
      
      {isAdmin && (
        <AddSongModal 
          isOpen={isAddSongOpen} 
          onClose={() => setIsAddSongOpen(false)} 
        />
      )}
    </div>
  );
};

export default Index;
