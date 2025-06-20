
import { Plus, RotateCcw, ArrowLeft, Key, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdminNavBarProps {
  onAddSongClick: () => void;
  onResetPasswordClick: () => void;
  onResetVotesClick: () => void;
  onUploadAlbumCoverClick: () => void;
}

export const AdminNavBar = ({ 
  onAddSongClick, 
  onResetPasswordClick, 
  onResetVotesClick,
  onUploadAlbumCoverClick
}: AdminNavBarProps) => {
  return (
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
            onClick={onUploadAlbumCoverClick}
            className="flex items-center gap-1.5 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-purple-200 dark:hover:bg-purple-800"
          >
            <ImageIcon className="h-4 w-4" />
            <span>Upload Album Cover</span>
          </button>
          
          <button
            onClick={onResetPasswordClick}
            className="flex items-center gap-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-blue-200 dark:hover:bg-blue-800"
          >
            <Key className="h-4 w-4" />
            <span>Reset Password</span>
          </button>
          
          <button
            onClick={onResetVotesClick}
            className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset All Votes</span>
          </button>
          
          <button
            onClick={onAddSongClick}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:opacity-90 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add Song</span>
          </button>
        </div>
      </div>
    </header>
  );
};
