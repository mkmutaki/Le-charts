
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useSongStore, useAuthStore } from '@/lib/store';
import { AddSongModal } from '@/components/AddSongModal';
import { EditSongModal } from '@/components/EditSongModal';
import { ResetPasswordModal } from '@/components/ResetPasswordModal';
import { AlbumCoverUploadModal } from '@/components/AlbumCoverUploadModal';
import { AdminNavBar } from './AdminNavBar';
import { AdminSongList } from './AdminSongList';
import { AdminLoader } from './AdminLoader';
import { AdminAccessDenied } from './AdminAccessDenied';
import { useAdminActions } from './useAdminActions';
import { Song } from '@/lib/types';

const Admin = () => {
  const { songs, fetchSongs } = useSongStore();
  const { currentUser, checkAdminStatus } = useAuthStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [isAlbumCoverUploadOpen, setIsAlbumCoverUploadOpen] = useState(false);
  
  const {
    isAddSongOpen,
    isEditSongOpen,
    isResetPasswordOpen,
    selectedSong,
    setIsAddSongOpen,
    setIsEditSongOpen,
    setIsResetPasswordOpen,
    setSelectedSong,
    handleResetVotes,
    handleDeleteSong,
    handleEditSong
  } = useAdminActions();
  
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
    return <AdminLoader />;
  }
  
  if (!isAdmin) {
    return <AdminAccessDenied />;
  }
  
  return (
    <div className="min-h-screen bg-background">
      <AdminNavBar
        onAddSongClick={() => setIsAddSongOpen(true)}
        onResetPasswordClick={() => setIsResetPasswordOpen(true)}
        onResetVotesClick={handleResetVotes}
        onUploadAlbumCoverClick={() => setIsAlbumCoverUploadOpen(true)}
      />
      
      <main className="max-w-6xl mx-auto px-4 py-8">
        <AdminSongList
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

      <ResetPasswordModal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
      />

      <AlbumCoverUploadModal
        isOpen={isAlbumCoverUploadOpen}
        onClose={() => setIsAlbumCoverUploadOpen(false)}
      />
    </div>
  );
};

export default Admin;
