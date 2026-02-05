import { useState, useEffect } from 'react';
import { Heart, ExternalLink } from 'lucide-react';
import { ScheduledSong } from '@/lib/types';
import { useVotingStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { getLocalDateString } from '@/lib/dateUtils';

interface ScheduledSongCardProps {
  song: ScheduledSong;
  rank: number;
}

export const ScheduledSongCard = ({ song, rank }: ScheduledSongCardProps) => {
  const { upvoteScheduledTrack, getUserVotedScheduledTrack, votedScheduledTrackId, currentVoteDate } = useVotingStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(song.votes);
  
  // Check if user has voted for this song
  useEffect(() => {
    const checkVoted = async () => {
      const currentDate = getLocalDateString();
      
      // First check local store state (fast path)
      if (currentVoteDate === currentDate && votedScheduledTrackId) {
        setHasVoted(votedScheduledTrackId === song.id);
        return;
      }
      
      // Check with the server for this device's vote for today
      const votedTrackId = await getUserVotedScheduledTrack(song.scheduledDate);
      setHasVoted(votedTrackId === song.id);
    };
    
    checkVoted();
    setVoteCount(song.votes);
  }, [song, getUserVotedScheduledTrack, votedScheduledTrackId, currentVoteDate]);
  
  // Update hasVoted when votedScheduledTrackId changes
  useEffect(() => {
    const currentDate = getLocalDateString();
    if (currentVoteDate === currentDate) {
      setHasVoted(votedScheduledTrackId === song.id);
    }
  }, [votedScheduledTrackId, currentVoteDate, song.id]);
  
  const handleVoteClick = async () => {
    if (isAnimating || hasVoted) return; // Prevent click if already voted or animating
    
    setIsAnimating(true);
    
    try {
      // Vote using the scheduled track system with the song's scheduled date
      const success = await upvoteScheduledTrack(song.id, song.scheduledDate);
      
      // Only update UI if vote was successful
      if (success) {
        setHasVoted(true);
        setVoteCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setTimeout(() => {
        setIsAnimating(false);
      }, 800);
    }
  };
  
  // Format duration from milliseconds to MM:SS
  const formatDuration = (ms: number | null): string => {
    if (!ms) return '';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
            src={song.artworkUrl || 'https://placehold.co/400x400/f5f5f7/1d1d1f?text=Cover'} 
            alt={`${song.trackName} by ${song.artistName}`}
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
            {song.trackName}
          </h3>
          <p className="text-muted-foreground text-sm md:text-base truncate mt-0.5">
            {song.artistName}
          </p>
          
          <div className="flex items-center gap-2 mt-1">
            {song.durationMs && (
              <span className="text-xs text-muted-foreground">
                {formatDuration(song.durationMs)}
              </span>
            )}
            {song.spotifyUrl && (
              <a 
                href={song.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Listen on Spotify <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        
        {/* Vote button - immutable once clicked */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <button
            onClick={handleVoteClick}
            disabled={isAnimating || hasVoted}
            className={cn(
              "p-2 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30",
              (isAnimating || hasVoted) ? "cursor-not-allowed" : "hover:bg-muted"
            )}
            aria-label={hasVoted ? `Already liked ${song.trackName}` : `Like ${song.trackName}`}
          >
            <Heart 
              className={cn(
                "h-5 w-5 md:h-6 md:w-6 transition-colors duration-200",
                isAnimating ? "text-primary heart-beat" : 
                hasVoted ? "text-primary" : 
                "text-muted-foreground group-hover:text-primary/80"
              )} 
              fill={hasVoted ? "currentColor" : "none"}
            />
          </button>
          <span className="text-xs md:text-sm font-medium">
            {voteCount}
          </span>
        </div>
      </div>
    </div>
  );
};
