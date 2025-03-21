
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, RotateCcw } from 'lucide-react';

interface AdminHeaderProps {
  onAddSong: () => void;
  onResetVotes: () => void;
}

export const AdminHeader = ({ onAddSong, onResetVotes }: AdminHeaderProps) => {
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
            onClick={onResetVotes}
            className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset All Votes</span>
          </button>
          
          <button
            onClick={onAddSong}
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
