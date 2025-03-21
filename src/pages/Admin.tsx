import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EditSongModal } from '@/components/EditSongModal';
import { AddSongModal } from '@/components/AddSongModal';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { SongsList } from '@/components/admin/SongsList';
import { useSongStore, useVotingStore } from '@/lib/store';
import { toast } from 'sonner';
import { Song } from '@/lib/types';

const Admin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditSongOpen, setIsEditSongOpen] = useState(false);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const { songs, fetchSongs, deleteSong } = useSongStore();
  const { resetVotes } = useVotingStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('user_roles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data) {
          setIsAdmin(true);
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
        } else {
          setIsAdmin(false);
        }
      }
    };

    checkAdminStatus();
  }, [fetchSongs, songs]);

  return (
    <div>
      {isAdmin && (
        <>
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
        </>
      )}
    </div>
  );
};

export default Admin;
