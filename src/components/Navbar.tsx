
import { useState, useEffect } from 'react';
import { Music, Plus, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddSongModal } from './AddSongModal';
import { useSongStore, useAuthStore, toggleAdminMode } from '@/lib/store';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const { currentUser } = useSongStore();
  const { checkIsAdmin } = useAuthStore();
  const isAdmin = checkIsAdmin();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header 
        className={cn(
          "fixed top-0 left-0 right-0 z-50 py-4 px-4 md:px-8 transition-all duration-300",
          isScrolled 
            ? "glass-effect shadow-sm" 
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">
              MusicChart
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Admin mode toggle (development only) */}
            <button
              onClick={toggleAdminMode}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                isAdmin 
                  ? "bg-amber-100 text-amber-800" 
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Shield className="h-3.5 w-3.5" />
              {isAdmin ? "Admin Mode" : "User Mode"}
            </button>
            
            {/* Add Song button - only visible to admins */}
            {isAdmin && (
              <button
                onClick={() => setIsAddSongOpen(true)}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-sm hover:opacity-90 transition-all duration-200 active:scale-95"
                aria-label="Add song"
              >
                <Plus className="h-4 w-4" />
                <span>Add Song</span>
              </button>
            )}
          </div>
        </div>
      </header>
      
      <div className="h-16" /> {/* Spacer for fixed header */}
      
      <AddSongModal 
        isOpen={isAddSongOpen} 
        onClose={() => setIsAddSongOpen(false)} 
      />
    </>
  );
};
