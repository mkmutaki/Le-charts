
import { useState, useEffect } from 'react';
import { Heart, ExternalLink } from 'lucide-react';
import { Song } from '@/lib/types';
import { useSongStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface SongCardProps {
  song: Song;
  rank: number;
}

export const SongCard = ({ song, rank }: SongCardProps) => {
  const { upvoteSong, currentUser } = useSongStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  
  useEffect(() => {
    // Check if current user has voted for this song
    if (currentUser && song.votedBy.includes(currentUser.id)) {
      setHasVoted(true);
    } else {
      setHasVoted(false);
    }
  }, [currentUser, song.votedBy]);
  
  const handleUpvote = async () => {
    if (isAnimating || hasVoted) return;
    
    setIsAnimating(true);
    await upvoteSong(song.id);
    
    setTimeout(() => {
      setIsAnimating(false);
    }, 800);
  };
  
  return (
    <div 
      className="group relative bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 animate-fade-up"
      style={{ animationDelay: `${rank * 50}ms` }}
    >
      <div className="flex items-center p-4 md:p-5 gap-3 md:gap-4">
        {/* Rank */}
        <div className="flex-shrink-0 w-8 md:w-10 h-8 md:h-10 flex items-center justify-center bg-muted rounded-lg text-foreground font-semibold text-sm md:text-base">
          {rank}
        </div>
        
        {/* Cover image */}
        <div className="flex-shrink-0 relative w-16 h-16 md:w-20 md:h-20 overflow-hidden rounded-lg shadow-sm">
          <img 
            src={song.coverUrl || 'https://placehold.co/400x400/f5f5f7/1d1d1f?text=Cover'} 
            alt={`${song.title} by ${song.artist}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'https://placehold.co/400x400/f5f5f7/1d1d1f?text=Cover';
            }}
          />
        </div>
        
        {/* Song details */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base md:text-lg truncate text-foreground">
            {song.title}
          </h3>
          <p className="text-muted-foreground text-sm md:text-base truncate mt-0.5">
            {song.artist}
          </p>
          
          {song.songUrl && (
            <a 
              href={song.songUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
            >
              Listen <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        
        {/* Upvote button */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <button
            onClick={handleUpvote}
            disabled={hasVoted}
            className={cn(
              "p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30",
              hasVoted ? "cursor-not-allowed" : "hover:bg-muted"
            )}
            aria-label={`Upvote ${song.title}`}
          >
            <Heart 
              className={cn(
                "h-5 w-5 md:h-6 md:w-6 transition-colors duration-200",
                isAnimating ? "text-primary heart-beat" : 
                hasVoted ? "text-primary" : "text-muted-foreground group-hover:text-primary/80"
              )} 
              fill={hasVoted || isAnimating ? "currentColor" : "none"}
            />
          </button>
          <span className="text-xs md:text-sm font-medium">
            {song.votes}
          </span>
        </div>
      </div>
    </div>
  );
};
