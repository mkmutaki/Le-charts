
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
        Your favorite Lesongs will be added to the chart, vote for the ONE you love.
      </p>
    </div>
  );
};
