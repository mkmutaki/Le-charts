
import { Song } from '@/lib/types';
import { AdminSongRow } from './AdminSongRow';

interface AdminSongListProps {
  songs: Song[];
  isLoading: boolean;
  onDeleteSong: (songId: string) => void;
  onEditSong: (song: Song) => void;
}

export const AdminSongList = ({ 
  songs, 
  isLoading,
  onDeleteSong,
  onEditSong 
}: AdminSongListProps) => {
  return (
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
              onDelete={() => onDeleteSong(song.id)}
              onEdit={() => onEditSong(song)}
            />
          ))
        )}
      </div>
    </div>
  );
};
