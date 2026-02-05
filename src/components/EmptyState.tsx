
import { Music, Calendar } from 'lucide-react';

type EmptyStateVariant = 'default' | 'no-scheduled-album';

interface EmptyStateProps {
  onAddClick?: () => void;
  variant?: EmptyStateVariant;
  scheduledDate?: string;
}

export const EmptyState = ({ onAddClick, variant = 'default', scheduledDate }: EmptyStateProps) => {
  if (variant === 'no-scheduled-album') {
    return (
      <div className="flex flex-col items-center justify-center py-16 md:py-24 px-4 rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/20 animate-fade-in">
        <div className="bg-muted/50 p-4 rounded-full mb-4">
          <Calendar className="h-12 w-12 text-muted-foreground/60" />
        </div>
        
        <h3 className="text-xl md:text-2xl font-medium text-foreground mb-2 text-center">
          No album scheduled for today
        </h3>
        
        <p className="text-muted-foreground text-center max-w-md">
          Check back tomorrow for a new album to vote on!
          {scheduledDate && (
            <span className="block mt-2 text-sm">
              Current date: {scheduledDate}
            </span>
          )}
        </p>
      </div>
    );
  }
  
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
