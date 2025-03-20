
import { useState } from 'react';
import { X } from 'lucide-react';
import { SongFormData } from '@/lib/types';
import { useSongStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddSongModal = ({ isOpen, onClose }: AddSongModalProps) => {
  const { addSong } = useSongStore();
  const [formData, setFormData] = useState<SongFormData>({
    title: '',
    artist: '',
    coverUrl: '',
  });
  
  const [errors, setErrors] = useState({
    title: '',
    artist: '',
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when user types
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const newErrors = {
      title: !formData.title.trim() ? 'Song title is required' : '',
      artist: !formData.artist.trim() ? 'Artist name is required' : '',
    };
    
    setErrors(newErrors);
    
    // If no errors, submit form
    if (!newErrors.title && !newErrors.artist) {
      addSong(formData);
      setFormData({ title: '', artist: '', coverUrl: '' });
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div 
        className="bg-card rounded-2xl shadow-lg w-full max-w-md overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-xl font-semibold">Add Song</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-2">
            <label htmlFor="title" className="block text-sm font-medium">
              Song Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={cn(
                "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all",
                errors.title ? "border-destructive" : "border-input"
              )}
              placeholder="Enter song title"
            />
            {errors.title && (
              <p className="text-destructive text-xs mt-1">{errors.title}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <label htmlFor="artist" className="block text-sm font-medium">
              Artist <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              id="artist"
              name="artist"
              value={formData.artist}
              onChange={handleChange}
              className={cn(
                "w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all",
                errors.artist ? "border-destructive" : "border-input"
              )}
              placeholder="Enter artist name"
            />
            {errors.artist && (
              <p className="text-destructive text-xs mt-1">{errors.artist}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <label htmlFor="coverUrl" className="block text-sm font-medium">
              Cover Image URL <span className="text-muted-foreground text-xs">(optional)</span>
            </label>
            <input
              type="url"
              id="coverUrl"
              name="coverUrl"
              value={formData.coverUrl}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              placeholder="https://example.com/cover-image.jpg"
            />
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium shadow-sm hover:opacity-90 transition-all active:scale-[0.98]"
            >
              Add to Chart
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
