
import { useState, useEffect } from 'react';
import { useSongStore, useVotingStore, useAuthStore } from '@/lib/store';
import { Song } from '@/lib/types';
import { AddSongModal } from '@/components/AddSongModal';
import { EditSongModal } from '@/components/EditSongModal';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { SongsList } from '@/components/admin/SongsList';
import { AccessDenied } from '@/components/admin/AccessDenied';

const Admin = () => {
  const { songs, fetchSongs, deleteSong } = useSongStore();
  const { resetVotes } = useVotingStore();
  const { checkIsAdmin } = useAuthStore();
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isEditSongOpen, setIsEditSongOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
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
    return <AccessDenied />;
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
      
      <EditSongModal
        isOpen={isEditSongOpen}
        onClose={() => {
          setIsEditSongOpen(false);
          setSelectedSong(null);
        }}
        song={selectedSong}
      />
    </div>
  );
};

export default Admin;
