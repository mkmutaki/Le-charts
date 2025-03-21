
import { useState, useEffect } from 'react';
import { X, Upload, Trash } from 'lucide-react';
import { Song, SongFormData } from '@/lib/types';
import { useSongStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface EditSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
}

export const EditSongModal = ({ isOpen, onClose, song }: EditSongModalProps) => {
  const { updateSong } = useSongStore();
  const [formData, setFormData] = useState<SongFormData>({
    title: '',
    artist: '',
    coverUrl: '',
    songUrl: '',
  });
  
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState({
    title: '',
    artist: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reset form when song changes
  useEffect(() => {
    if (song) {
      setFormData({
        title: song.title,
        artist: song.artist,
        coverUrl: song.coverUrl || '',
        songUrl: song.songUrl || '',
      });
      setCoverPreview(song.coverUrl || '');
    }
  }, [song]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when user types
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCoverFile(file);
    
    // Create a preview URL
    const fileUrl = URL.createObjectURL(file);
    setCoverPreview(fileUrl);
  };
  
  const removeCoverImage = () => {
    setCoverFile(null);
    setCoverPreview('');
    setFormData(prev => ({ ...prev, coverUrl: '' }));
  };
  
  const uploadCoverImage = async (): Promise<string | null> => {
    if (!coverFile) {
      return formData.coverUrl || null;
    }
    
    setIsUploading(true);
    
    try {
      // Generate a unique file name
      const fileExt = coverFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;
      
      // Upload the file to Supabase storage
      const { data, error } = await supabase.storage
        .from('song_covers')
        .upload(filePath, coverFile);
      
      if (error) {
        throw error;
      }
      
      // Get the public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from('song_covers')
        .getPublicUrl(filePath);
        
      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading cover image:', error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const newErrors = {
      title: !formData.title.trim() ? 'Song title is required' : '',
      artist: !formData.artist.trim() ? 'Artist name is required' : '',
    };
    
    setErrors(newErrors);
    
    if (!song) return;
    
    // If no errors, submit form
    if (!newErrors.title && !newErrors.artist) {
      setIsSubmitting(true);
      
      try {
        // Upload cover image if there's a new one
        let coverUrl = formData.coverUrl;
        if (coverFile) {
          const uploadedUrl = await uploadCoverImage();
          if (uploadedUrl) {
            coverUrl = uploadedUrl;
          }
        }
        
        await updateSong(song.id, {
          ...formData,
          coverUrl,
        });
        
        onClose();
      } catch (error) {
        console.error('Error updating song:', error);
      } finally {
        setIsSubmitting(false);
      }
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
          <h2 className="text-xl font-semibold">Edit Song</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors"
            aria-label="Close modal"
            disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
            />
            {errors.artist && (
              <p className="text-destructive text-xs mt-1">{errors.artist}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <label htmlFor="songUrl" className="block text-sm font-medium">
              Song Link <span className="text-muted-foreground text-xs">(Spotify, Apple Music, etc.)</span>
            </label>
            <input
              type="url"
              id="songUrl"
              name="songUrl"
              value={formData.songUrl}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-lg border border-input focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              placeholder="https://open.spotify.com/track/..."
              disabled={isSubmitting}
            />
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Cover Image
            </label>
            
            {coverPreview ? (
              <div className="relative rounded-lg overflow-hidden w-full h-40 group">
                <img 
                  src={coverPreview} 
                  alt="Cover preview" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={removeCoverImage}
                    className="p-2 bg-destructive rounded-full text-white hover:bg-destructive/90 transition-colors"
                  >
                    <Trash className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-input rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload cover image
                  </p>
                </div>
                <input 
                  type="file" 
                  id="coverFile" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                />
              </label>
            )}
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              className={cn(
                "w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium shadow-sm hover:opacity-90 transition-all",
                (isSubmitting || isUploading) ? "opacity-70 cursor-not-allowed" : "active:scale-[0.98]"
              )}
              disabled={isSubmitting || isUploading}
            >
              {isSubmitting ? 'Saving...' : isUploading ? 'Uploading...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
