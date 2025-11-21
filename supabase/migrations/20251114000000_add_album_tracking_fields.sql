-- Add album tracking fields to LeSongs table
-- This migration adds support for album metadata while maintaining backward compatibility

-- Add album-related columns to LeSongs table
ALTER TABLE public."LeSongs" 
ADD COLUMN album_name TEXT NULL,
ADD COLUMN album_id TEXT NULL,
ADD COLUMN itunes_track_id TEXT NULL,
ADD COLUMN track_number INTEGER NULL,
ADD COLUMN track_duration_ms INTEGER NULL;

-- Create unique index on itunes_track_id for deduplication
-- Partial index to allow multiple NULL values (for songs without iTunes metadata)
CREATE UNIQUE INDEX idx_lesongs_itunes_track_id 
ON public."LeSongs" (itunes_track_id) 
WHERE itunes_track_id IS NOT NULL;

-- Add comment to document the purpose of these fields
COMMENT ON COLUMN public."LeSongs".album_name IS 'The name of the album this song belongs to';
COMMENT ON COLUMN public."LeSongs".album_id IS 'iTunes album identifier for grouping songs';
COMMENT ON COLUMN public."LeSongs".itunes_track_id IS 'Unique iTunes track identifier for deduplication';
COMMENT ON COLUMN public."LeSongs".track_number IS 'Track number within the album';
COMMENT ON COLUMN public."LeSongs".track_duration_ms IS 'Track duration in milliseconds';
