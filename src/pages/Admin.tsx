
import { useState, useEffect } from 'react';
import { Plus, Trash2, RotateCcw, ArrowLeft, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSongStore, useVotingStore, useAuthStore } from '@/lib/store';
import { Song } from '@/lib/types';
import { AddSongModal } from '@/components/AddSongModal';
import { cn } from '@/lib/utils';

const Admin = () => {
  const { songs, fetchSongs, deleteSong } = useSongStore();
  const { resetVotes } = useVotingStore();
  const { checkIsAdmin } = useAuthStore();
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = checkIsAdmin();
  
  useEffect(() => {
    const loadSongs = async () => {
      await fetchSongs();
      setIsLoading(false);
    };
    
    loadSongs();
  }, [fetchSongs]);
  
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-destructive/10 text-destructive p-6 rounded-lg max-w-md text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="mb-4">You don't have permission to access this page.</p>
          <Link 
            to="/"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Chart
          </Link>
        </div>
      </div>
    );
  }

  const handleResetVotes = () => {
    if (window.confirm('Are you sure you want to reset all votes? This cannot be undone.')) {
      resetVotes();
    }
  };

  const handleDeleteSong = (songId: string) => {
    if (window.confirm('Are you sure you want to delete this song? This cannot be undone.')) {
      deleteSong(songId);
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              to="/"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Chart</span>
            </Link>
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetVotes}
              className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset All Votes</span>
            </button>
            
            <button
              onClick={() => setIsAddSongOpen(true)}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:opacity-90 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add Song</span>
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/40">
            <h2 className="font-semibold">Manage Songs</h2>
          </div>
          
          <div className="divide-y">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading songs...
              </div>
            ) : songs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No songs have been added yet.
              </div>
            ) : (
              songs.map((song) => (
                <AdminSongRow 
                  key={song.id} 
                  song={song} 
                  onDelete={() => handleDeleteSong(song.id)} 
                />
              ))
            )}
          </div>
        </div>
      </main>
      
      <AddSongModal 
        isOpen={isAddSongOpen} 
        onClose={() => setIsAddSongOpen(false)} 
      />
    </div>
  );
};

const AdminSongRow = ({ song, onDelete }: { song: Song, onDelete: () => void }) => {
  return (
    <div className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
      <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
        <img 
          src={song.coverUrl || 'https://placehold.co/400x400/f5f5f7/1d1d1f?text=Cover'} 
          alt={song.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://placehold.co/400x400/f5f5f7/1d1d1f?text=Cover';
          }}
        />
      </div>
      
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{song.title}</h3>
        <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
        
        {song.songUrl && (
          <a 
            href={song.songUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary mt-0.5 hover:underline"
          >
            Listen <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      
      <div className="flex-shrink-0 text-sm text-muted-foreground px-3 py-1 bg-muted rounded-full">
        {song.votes} votes
      </div>
      
      <button 
        onClick={onDelete}
        className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-full hover:bg-muted"
        aria-label={`Delete ${song.title}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

export default Admin;
