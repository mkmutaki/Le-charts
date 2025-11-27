import { useState, useEffect } from 'react';
import { Plus, Trash2, RotateCcw, ArrowLeft, ExternalLink, Pencil, Key } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useSongStore, useVotingStore, useAuthStore } from '@/lib/store';
import { Song } from '@/lib/types';
import { AlbumSearchModal } from '@/components/AlbumSearchModal';
import { EditSongModal } from '@/components/EditSongModal';
import { ResetPasswordModal } from '@/components/ResetPasswordModal';
import { useAdminTimeout } from '@/hooks/useAdminTimeout';
import { toast } from 'sonner';

const Admin = () => {
  const { songs, fetchSongs, deleteSong } = useSongStore();
  const { resetVotes } = useVotingStore();
  const { currentUser, checkAdminStatus } = useAuthStore();
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isEditSongOpen, setIsEditSongOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const navigate = useNavigate();
  
  // Admin session timeout - automatically logs out after 10 minutes of inactivity
  useAdminTimeout({ enabled: isAdmin && !isCheckingAdmin });
  
  useEffect(() => {
    const verifyAdmin = async () => {
      setIsCheckingAdmin(true);
      
      if (!currentUser) {
        setIsAdmin(false);
        setIsCheckingAdmin(false);
        return;
      }
      
      try {
        const adminStatus = await checkAdminStatus();
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error('Error verifying admin status:', error);
        toast.error('Failed to verify admin permissions');
        setIsAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    };
    
    verifyAdmin();
  }, [currentUser, checkAdminStatus]);
  
  useEffect(() => {
    const loadSongs = async () => {
      if (!isCheckingAdmin && isAdmin) {
        setIsLoading(true);
        await fetchSongs();
        setIsLoading(false);
      }
    };
    
    loadSongs();
  }, [isCheckingAdmin, isAdmin, fetchSongs]);
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  if (isCheckingAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="p-6 rounded-lg max-w-md text-center">
          <h2 className="text-xl font-semibold mb-2">Verifying access...</h2>
          <div className="mt-4 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }
  
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

  const handleResetVotes = async () => {
    if (window.confirm('Are you sure you want to reset all votes? This cannot be undone.')) {
      try {
        const adminCheck = await checkAdminStatus();
        if (!adminCheck) {
          toast.error('Admin verification failed. Please log in again.');
          navigate('/login');
          return;
        }
        
        await resetVotes();
        await fetchSongs();
        toast.success('All votes have been reset');
      } catch (error) {
        console.error('Error resetting votes:', error);
        toast.error('Failed to reset votes');
      }
    }
  };

  const handleDeleteSong = async (songId: string) => {
    if (window.confirm('Are you sure you want to delete this song? This cannot be undone.')) {
      try {
        const adminCheck = await checkAdminStatus();
        if (!adminCheck) {
          toast.error('Admin verification failed. Please log in again.');
          navigate('/login');
          return;
        }
        
        await deleteSong(songId);
        toast.success('Song deleted successfully');
      } catch (error) {
        console.error('Error deleting song:', error);
        toast.error('Failed to delete song');
      }
    }
  };
  
  const handleEditSong = (song: Song) => {
    setSelectedSong(song);
    setIsEditSongOpen(true);
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
              onClick={() => setIsResetPasswordOpen(true)}
              className="flex items-center gap-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
            >
              <Key className="h-4 w-4" />
              <span>Reset Password</span>
            </button>
            
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
              <span>Search Albums</span>
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
                  onEdit={() => handleEditSong(song)}
                />
              ))
            )}
          </div>
        </div>
      </main>
      
      <AlbumSearchModal 
        isOpen={isAddSongOpen} 
        onClose={() => setIsAddSongOpen(false)} 
        onAlbumUploaded={fetchSongs}
      />
      
      <EditSongModal
        isOpen={isEditSongOpen}
        onClose={() => {
          setIsEditSongOpen(false);
          setSelectedSong(null);
        }}
        song={selectedSong}
      />

      <ResetPasswordModal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
      />
    </div>
  );
};

const AdminSongRow = ({ 
  song, 
  onDelete, 
  onEdit 
}: { 
  song: Song, 
  onDelete: () => void,
  onEdit: () => void
}) => {
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
      
      <div className="flex-shrink-0 flex items-center gap-2">
        <button 
          onClick={onEdit}
          className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-full hover:bg-muted"
          aria-label={`Edit ${song.title}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
        
        <button 
          onClick={onDelete}
          className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-full hover:bg-muted"
          aria-label={`Delete ${song.title}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Admin;
