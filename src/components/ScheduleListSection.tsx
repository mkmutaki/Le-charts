import { useState } from 'react';
import { Music, Calendar, Pencil, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScheduleStore } from '@/lib/stores/useScheduleStore';
import { ScheduledAlbum } from '@/lib/services/scheduledAlbumService';
import { formatScheduledDate, getRelativeDayDescription, isPastDate, getLocalDateString } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ScheduleListSectionProps {
  onEditSchedule?: (schedule: ScheduledAlbum) => void;
}

export const ScheduleListSection = ({ onEditSchedule }: ScheduleListSectionProps) => {
  const { scheduledAlbums, isLoading, deleteSchedule } = useScheduleStore();
  
  const [deleteTarget, setDeleteTarget] = useState<ScheduledAlbum | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    setIsDeleting(true);
    try {
      await deleteSchedule(deleteTarget.id);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };
  
  const today = getLocalDateString();
  
  // Sort albums by scheduled date (ascending)
  const sortedAlbums = [...scheduledAlbums].sort((a, b) => 
    a.scheduled_date.localeCompare(b.scheduled_date)
  );
  
  // Separate past, today, and future albums
  const pastAlbums = sortedAlbums.filter(album => album.scheduled_date < today);
  const todayAlbum = sortedAlbums.find(album => album.scheduled_date === today);
  const futureAlbums = sortedAlbums.filter(album => album.scheduled_date > today);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduled Albums
        </h3>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
              <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-9 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (scheduledAlbums.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduled Albums
        </h3>
        <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-lg text-center">
          <Music className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">No albums scheduled</p>
          <p className="text-sm text-muted-foreground mt-1">
            Use the "Schedule Album" button to add albums to the calendar
          </p>
        </div>
      </div>
    );
  }
  
  const renderAlbumItem = (album: ScheduledAlbum, variant: 'past' | 'today' | 'future') => {
    const isPast = variant === 'past';
    const isToday = variant === 'today';
    
    return (
      <div
        key={album.id}
        className={cn(
          "flex items-center gap-4 p-4 rounded-lg transition-colors",
          isPast && "bg-muted/20 opacity-60",
          isToday && "bg-primary/10 border border-primary/30",
          variant === 'future' && "bg-muted/30 hover:bg-muted/50"
        )}
      >
        {/* Album cover */}
        <div className="relative flex-shrink-0">
          <img
            src={album.artwork_url}
            alt={`${album.album_name} cover`}
            className={cn(
              "w-16 h-16 rounded-lg shadow-sm object-cover",
              isPast && "grayscale"
            )}
            loading="lazy"
          />
          {isToday && (
            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              LIVE
            </div>
          )}
        </div>
        
        {/* Album info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold line-clamp-1">{album.album_name}</h4>
          <p className="text-sm text-muted-foreground line-clamp-1">{album.artist_name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={isPast ? 'secondary' : isToday ? 'default' : 'outline'} className="text-xs">
              {formatScheduledDate(album.scheduled_date)}
            </Badge>
            {!isPast && (
              <span className="text-xs text-muted-foreground">
                {getRelativeDayDescription(album.scheduled_date)}
              </span>
            )}
          </div>
        </div>
        
        {/* Actions - only show for future albums */}
        {variant === 'future' && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditSchedule?.(album)}
              className="h-9 w-9"
              title="Edit schedule"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteTarget(album)}
              className="h-9 w-9 text-destructive hover:text-destructive"
              title="Delete schedule"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <>
      <div className="space-y-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduled Albums
          <Badge variant="secondary" className="ml-2">
            {scheduledAlbums.length}
          </Badge>
        </h3>
        
        {/* Today's album */}
        {todayAlbum && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Today</h4>
            {renderAlbumItem(todayAlbum, 'today')}
          </div>
        )}
        
        {/* Upcoming albums */}
        {futureAlbums.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Upcoming</h4>
            <div className="space-y-2">
              {futureAlbums.map((album) => renderAlbumItem(album, 'future'))}
            </div>
          </div>
        )}
        
        {/* Past albums (collapsed by default or limited) */}
        {pastAlbums.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Past ({pastAlbums.length})
            </h4>
            <div className="space-y-2">
              {pastAlbums.slice(-3).reverse().map((album) => renderAlbumItem(album, 'past'))}
            </div>
            {pastAlbums.length > 3 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Showing most recent 3 of {pastAlbums.length} past albums
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheduled Album?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{deleteTarget?.album_name}" scheduled for{' '}
              {deleteTarget && formatScheduledDate(deleteTarget.scheduled_date)}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
