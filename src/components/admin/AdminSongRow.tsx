
import { Song } from '@/lib/types';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';

interface AdminSongRowProps {
  song: Song;
  onDelete: () => void;
  onEdit: () => void;
}

export const AdminSongRow = ({ song, onDelete, onEdit }: AdminSongRowProps) => {
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
