
import { useState, useEffect } from 'react';
import { useSongStore, useVotingStore, useAuthStore } from '@/lib/store';
import { Song } from '@/lib/types';
import { AddSongModal } from '@/components/AddSongModal';
import { EditSongModal } from '@/components/EditSongModal';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { SongsList } from '@/components/admin/SongsList';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { toast } from 'sonner';

const Admin = () => {
  const { songs, fetchSongs, deleteSong } = useSongStore();
  const { resetVotes } = useVotingStore();
  const { currentUser, checkIsAdmin } = useAuthStore();
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isEditSongOpen, setIsEditSongOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = checkIsAdmin();
  
  useEffect(() => {
    const loadSongs = async () => {
      setIsLoading(true);
      try {
        await fetchSongs();
      } catch (error) {
        console.error("Error fetching songs:", error);
        toast.error("Failed to fetch songs");
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isAdmin) {
      loadSongs();
    }
  }, [fetchSongs, isAdmin]);
  
  useEffect(() => {
    console.log("Admin check:", { isAdmin, currentUser });
  }, [isAdmin, currentUser]);
  
  if (!isAdmin) {
    return <AccessDenied />;
  }

  const handleResetVotes = async () => {
    if (window.confirm('Are you sure you want to reset all votes? This cannot be undone.')) {
      try {
        await resetVotes();
        toast.success("All votes have been reset");
        // Refresh the songs list after resetting votes
        await fetchSongs();
      } catch (error) {
        console.error("Error resetting votes:", error);
        toast.error("Failed to reset votes");
      }
    }
  };

  const handleDeleteSong = async (songId: string) => {
    if (window.confirm('Are you sure you want to delete this song? This cannot be undone.')) {
      try {
        await deleteSong(songId);
        toast.success("Song deleted successfully");
      } catch (error) {
        console.error("Error deleting song:", error);
        toast.error("Failed to delete song");
      }
    }
  };
  
  const handleEditSong = (song: Song) => {
    setSelectedSong(song);
    setIsEditSongOpen(true);
  };
  
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader 
        onAddSong={() => setIsAddSongOpen(true)} 
        onResetVotes={handleResetVotes} 
      />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <SongsList
          songs={songs}
          isLoading={isLoading}
          onDeleteSong={handleDeleteSong}
          onEditSong={handleEditSong}
        />
      </main>
      
      <AddSongModal 
        isOpen={isAddSongOpen} 
        onClose={() => setIsAddSongOpen(false)} 
      />
      
      {selectedSong && (
        <EditSongModal
          isOpen={isEditSongOpen}
          onClose={() => {
            setIsEditSongOpen(false);
            setSelectedSong(null);
          }}
          song={selectedSong}
        />
      )}
    </div>
  );
};

export default Admin;
