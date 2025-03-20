
import { useState } from 'react';
import { Music, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddSongModal } from './AddSongModal';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);

  // Handle scroll event to change navbar appearance
  useState(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  });

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
          
          <button
            onClick={() => setIsAddSongOpen(true)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium shadow-sm hover:opacity-90 transition-all duration-200 active:scale-95"
            aria-label="Add song"
          >
            <Plus className="h-4 w-4" />
            <span>Add Song</span>
          </button>
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
