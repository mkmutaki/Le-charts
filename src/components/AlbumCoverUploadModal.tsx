
import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePuzzleSettings } from '@/hooks/usePuzzleSettings';

interface AlbumCoverUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlbumCoverUploadModal = ({ isOpen, onClose }: AlbumCoverUploadModalProps) => {
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { updateAlbumCover } = usePuzzleSettings();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select an image file');
      return;
    }

    setUploading(true);
    
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `album-cover-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('album_covers')
        .upload(fileName, selectedFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error('Failed to upload album cover');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('album_covers')
        .getPublicUrl(fileName);

      const success = await updateAlbumCover(publicUrl, albumTitle || undefined, albumArtist || undefined);
      
      if (success) {
        onClose();
        setSelectedFile(null);
        setAlbumTitle('');
        setAlbumArtist('');
      }
    } catch (error) {
      console.error('Error uploading album cover:', error);
      toast.error('Failed to upload album cover');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Upload Album Cover</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="albumFile">Album Cover Image</Label>
            <Input
              id="albumFile"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="mt-1"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground mt-1">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="albumTitle">Album Title (Optional)</Label>
            <Input
              id="albumTitle"
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="Enter album title"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="albumArtist">Artist (Optional)</Label>
            <Input
              id="albumArtist"
              value={albumArtist}
              onChange={(e) => setAlbumArtist(e.target.value)}
              placeholder="Enter artist name"
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="flex-1"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
