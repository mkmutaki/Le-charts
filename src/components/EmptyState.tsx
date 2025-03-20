
import { Music, Plus } from 'lucide-react';

interface EmptyStateProps {
  onAddClick: () => void;
}

export const EmptyState = ({ onAddClick }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 md:py-24 px-4 rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/20 animate-fade-in">
      <div className="bg-muted/50 p-4 rounded-full mb-4">
        <Music className="h-12 w-12 text-muted-foreground/60" />
      </div>
      
      <h3 className="text-xl md:text-2xl font-medium text-foreground mb-2 text-center">
        No songs in the chart yet
      </h3>
      
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Add your favorite songs to the chart and vote for the ones you love.
      </p>
      
      <button
        onClick={onAddClick}
        className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:opacity-90 transition-all duration-200 active:scale-95"
      >
        <Plus className="h-4 w-4" />
        <span>Add First Song</span>
      </button>
    </div>
  );
};
