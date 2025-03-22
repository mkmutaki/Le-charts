
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EditSongModal } from '@/components/EditSongModal';
import { AddSongModal } from '@/components/AddSongModal';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { SongsList } from '@/components/admin/SongsList';
import { useSongStore, useVotingStore, useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { Song } from '@/lib/types';

const Admin = () => {
  const [isEditSongOpen, setIsEditSongOpen] = useState(false);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const { songs, fetchSongs, deleteSong } = useSongStore();
  const { resetVotes } = useVotingStore();
  const [isLoading, setIsLoading] = useState(true);
  const { currentUser, checkIsAdmin } = useAuthStore();
  const isAdmin = checkIsAdmin();

  useEffect(() => {
    const loadSongs = async () => {
      if (isAdmin) {
        setIsLoading(true);
        try {
          console.log('Fetching songs for admin page...');
          await fetchSongs();
          console.log('Songs fetched successfully:', songs);
        } catch (error) {
          console.error("Error fetching songs:", error);
          toast.error("Failed to fetch songs");
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadSongs();
  }, [fetchSongs, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to access the admin dashboard.</p>
      </div>
    );
  }

  return (
    <div>
      <AdminHeader
        onAddSong={() => setIsAddSongOpen(true)}
        onResetVotes={resetVotes}
      />
      <SongsList
        songs={songs}
        isLoading={isLoading}
        onDeleteSong={deleteSong}
        onEditSong={(song) => {
          setSelectedSong(song);
          setIsEditSongOpen(true);
        }}
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
      <AddSongModal
        isOpen={isAddSongOpen}
        onClose={() => setIsAddSongOpen(false)}
      />
    </div>
  );
};

export default Admin;
