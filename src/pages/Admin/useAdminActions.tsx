
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSongStore, useVotingStore, useAuthStore } from '@/lib/store';
import { Song } from '@/lib/types';
import { toast } from 'sonner';

export const useAdminActions = () => {
  const { songs, deleteSong, fetchSongs } = useSongStore();
  const { resetVotes } = useVotingStore();
  const { checkAdminStatus } = useAuthStore();
  const navigate = useNavigate();
  
  // Modal states
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isEditSongOpen, setIsEditSongOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  
  // Handle reset votes
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

  // Handle delete song
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
  
  // Handle edit song
  const handleEditSong = (song: Song) => {
    setSelectedSong(song);
    setIsEditSongOpen(true);
  };
  
  return {
    // States
    isAddSongOpen,
    isEditSongOpen,
    isResetPasswordOpen,
    selectedSong,
    
    // Setters
    setIsAddSongOpen,
    setIsEditSongOpen,
    setIsResetPasswordOpen,
    setSelectedSong,
    
    // Actions
    handleResetVotes,
    handleDeleteSong,
    handleEditSong
  };
};
