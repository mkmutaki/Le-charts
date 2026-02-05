import { useState, useEffect } from 'react';
import { Plus, Trash2, RotateCcw, ArrowLeft, ExternalLink, Key, Calendar, Music } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useSongStore, useVotingStore, useAuthStore, useScheduleStore } from '@/lib/store';
import { ScheduledSong } from '@/lib/types';
import { AlbumSearchModal } from '@/components/AlbumSearchModal';
import { ResetPasswordModal } from '@/components/ResetPasswordModal';
import { ScheduleAlbumModal } from '@/components/ScheduleAlbumModal';
import { ScheduleListSection } from '@/components/ScheduleListSection';
import { EditScheduleModal } from '@/components/EditScheduleModal';
import { ScheduledAlbum } from '@/lib/services/scheduledAlbumService';
import { getLocalDateString, formatScheduledDate } from '@/lib/dateUtils';
import { useAdminTimeout } from '@/hooks/useAdminTimeout';
import { toast } from 'sonner';

const Admin = () => {
  const { scheduledSongs, fetchScheduledSongs, currentAlbum } = useSongStore();
  const { resetScheduledVotes } = useVotingStore();
  const { currentUser, checkAdminStatus } = useAuthStore();
  const { scheduledAlbums, fetchScheduledAlbums } = useScheduleStore();
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isEditScheduleModalOpen, setIsEditScheduleModalOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduledAlbum | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const navigate = useNavigate();
  const today = getLocalDateString();
  
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
    const loadData = async () => {
      if (!isCheckingAdmin && isAdmin) {
        setIsLoading(true);
        await Promise.all([
          fetchScheduledSongs(today, { force: true }), 
          fetchScheduledAlbums()
        ]);
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [isCheckingAdmin, isAdmin, fetchScheduledSongs, fetchScheduledAlbums, today]);
  
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
    if (window.confirm('Are you sure you want to reset all votes for today? This cannot be undone.')) {
      try {
        const adminCheck = await checkAdminStatus();
        if (!adminCheck) {
          toast.error('Admin verification failed. Please log in again.');
          navigate('/login');
          return;
        }
        
        await resetScheduledVotes(today);
        await fetchScheduledSongs(today, { force: true });
        toast.success('All votes for today have been reset');
      } catch (error) {
        console.error('Error resetting votes:', error);
        toast.error('Failed to reset votes');
      }
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
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddSongOpen(true)}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:opacity-90 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Search Albums</span>
            </button>
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="flex items-center gap-1.5 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:opacity-90 transition-all active:scale-95"
            >
              <Calendar className="h-4 w-4" />
              <span>Schedule Album</span>
            </button>
            <button
              onClick={handleResetVotes}
              className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset All Votes</span>
            </button>
            <button
              onClick={() => setIsResetPasswordOpen(true)}
              className="flex items-center gap-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
            >
              <Key className="h-4 w-4" />
              <span>Reset Password</span>
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Scheduled Albums Section */}
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden p-6">
          <ScheduleListSection 
            onEditSchedule={(schedule) => {
              setSelectedSchedule(schedule);
              setIsEditScheduleModalOpen(true);
            }}
          />
        </div>
        
        {/* Today's Album Section - Read Only */}
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Today's Album</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatScheduledDate(today)} • {currentAlbum ? `${currentAlbum.name} by ${currentAlbum.artist}` : 'No album scheduled'}
                </p>
              </div>
              {scheduledSongs.length > 0 && (
                <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {scheduledSongs.length} tracks • Read only
                </span>
              )}
            </div>
          </div>
          
          <div className="divide-y">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading tracks...
              </div>
            ) : scheduledSongs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No album scheduled for today.</p>
                <p className="text-sm mt-1">Use "Search Albums" or "Schedule Album" to add content.</p>
              </div>
            ) : (
              scheduledSongs.map((track) => (
                <ScheduledTrackRow 
                  key={track.id} 
                  track={track}
                />
              ))
            )}
          </div>
        </div>
      </main>
      
      <AlbumSearchModal 
        isOpen={isAddSongOpen} 
        onClose={() => setIsAddSongOpen(false)} 
        onAlbumUploaded={() => fetchScheduledSongs(today, { force: true })}
      />

      <ResetPasswordModal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
      />

      <ScheduleAlbumModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onScheduled={async () => {
          await Promise.all([
            fetchScheduledAlbums(),
            fetchScheduledSongs(today, { force: true })
          ]);
        }}
      />

      <EditScheduleModal
        isOpen={isEditScheduleModalOpen}
        schedule={selectedSchedule}
        onClose={() => {
          setIsEditScheduleModalOpen(false);
          setSelectedSchedule(null);
        }}
        onUpdated={async () => {
          await Promise.all([
            fetchScheduledAlbums(),
            fetchScheduledSongs(today, { force: true })
          ]);
        }}
      />
    </div>
  );
};

// Read-only component for displaying scheduled tracks
const ScheduledTrackRow = ({ track }: { track: ScheduledSong }) => {
  // Format duration
  const duration = track.durationMs ? Math.floor(track.durationMs / 1000) : 0;
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
      <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0">
        <img 
          src={track.artworkUrl || 'https://placehold.co/400x400/f5f5f7/1d1d1f?text=Cover'} 
          alt={track.trackName}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://placehold.co/400x400/f5f5f7/1d1d1f?text=Cover';
          }}
        />
      </div>
      
      <div className="flex-shrink-0 w-8 text-sm text-muted-foreground text-center">
        {track.trackNumber}
      </div>
      
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{track.trackName}</h3>
        <p className="text-sm text-muted-foreground truncate">{track.artistName}</p>
        
        {track.spotifyUrl && (
          <a 
            href={track.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary mt-0.5 hover:underline"
          >
            Listen <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      
      <div className="flex-shrink-0 text-sm text-muted-foreground">
        {duration > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : '-'}
      </div>
      
      <div className="flex-shrink-0 text-sm text-muted-foreground px-3 py-1 bg-muted rounded-full">
        {track.votes} votes
      </div>
    </div>
  );
};

export default Admin;
