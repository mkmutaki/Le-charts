-- Migration: Add Scheduled Albums Feature
-- Created: 2026-02-02
-- Description: Implements Wordle-style scheduled album uploads with date-based display

-- ============================================
-- Phase 1.1: Create scheduled_albums table
-- ============================================
CREATE TABLE public.scheduled_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spotify_album_id TEXT NOT NULL,
  album_name TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  artwork_url TEXT NOT NULL,
  track_count INTEGER NOT NULL,
  scheduled_date DATE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.scheduled_albums IS 'Stores albums scheduled for specific dates in the Wordle-style daily rotation';
COMMENT ON COLUMN public.scheduled_albums.status IS 'pending = scheduled for future, completed = already shown';
COMMENT ON COLUMN public.scheduled_albums.scheduled_date IS 'The date this album will be displayed to users (based on their local time)';

-- ============================================
-- Phase 1.2: Create scheduled_album_tracks table
-- ============================================
CREATE TABLE public.scheduled_album_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_album_id UUID NOT NULL REFERENCES public.scheduled_albums(id) ON DELETE CASCADE,
  spotify_track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  track_number INTEGER NOT NULL,
  duration_ms INTEGER,
  artwork_url TEXT,
  preview_url TEXT,
  spotify_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.scheduled_album_tracks IS 'Stores tracks for scheduled albums - votes reference these directly';
COMMENT ON COLUMN public.scheduled_album_tracks.scheduled_album_id IS 'FK to the parent scheduled album';

-- ============================================
-- Phase 1.3: Modify song_votes table
-- ============================================
ALTER TABLE public.song_votes ADD COLUMN scheduled_date DATE;
ALTER TABLE public.song_votes ADD COLUMN scheduled_track_id UUID REFERENCES public.scheduled_album_tracks(id);

COMMENT ON COLUMN public.song_votes.scheduled_date IS 'The date this vote was cast for (scopes votes to specific days)';
COMMENT ON COLUMN public.song_votes.scheduled_track_id IS 'FK to scheduled_album_tracks for new scheduling system (nullable for backward compat)';

-- ============================================
-- Phase 1.4: Create indexes for performance
-- ============================================
CREATE INDEX idx_scheduled_albums_date ON public.scheduled_albums(scheduled_date);
CREATE INDEX idx_scheduled_albums_status ON public.scheduled_albums(status);
CREATE INDEX idx_scheduled_album_tracks_album_id ON public.scheduled_album_tracks(scheduled_album_id);
CREATE INDEX idx_song_votes_scheduled_date ON public.song_votes(scheduled_date);
CREATE INDEX idx_song_votes_scheduled_track_id ON public.song_votes(scheduled_track_id);

-- ============================================
-- Phase 1.5: Set up Row Level Security
-- ============================================

-- Enable RLS on scheduled_albums
ALTER TABLE public.scheduled_albums ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage scheduled albums"
ON public.scheduled_albums
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid()::text
    AND user_roles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid()::text
    AND user_roles.is_admin = true
  )
);

-- Policy: Anyone (including anon) can SELECT albums for today or past dates
CREATE POLICY "Anyone can view active scheduled albums"
ON public.scheduled_albums
FOR SELECT
USING (scheduled_date <= CURRENT_DATE);

-- Grant permissions to roles
GRANT SELECT ON public.scheduled_albums TO anon;
GRANT SELECT ON public.scheduled_albums TO authenticated;
GRANT ALL ON public.scheduled_albums TO authenticated;

-- Enable RLS on scheduled_album_tracks
ALTER TABLE public.scheduled_album_tracks ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can do everything (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage scheduled album tracks"
ON public.scheduled_album_tracks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid()::text
    AND user_roles.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid()::text
    AND user_roles.is_admin = true
  )
);

-- Policy: Anyone (including anon) can SELECT tracks for today's or past albums
CREATE POLICY "Anyone can view tracks for active albums"
ON public.scheduled_album_tracks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.scheduled_albums
    WHERE scheduled_albums.id = scheduled_album_tracks.scheduled_album_id
    AND scheduled_albums.scheduled_date <= CURRENT_DATE
  )
);

-- Grant permissions to roles
GRANT SELECT ON public.scheduled_album_tracks TO anon;
GRANT SELECT ON public.scheduled_album_tracks TO authenticated;
GRANT ALL ON public.scheduled_album_tracks TO authenticated;

-- Update song_votes RLS for scheduled votes
CREATE POLICY "Allow anonymous users to insert scheduled votes"
ON public.song_votes
FOR INSERT
WITH CHECK (
  (song_id IS NOT NULL OR scheduled_track_id IS NOT NULL)
  AND device_id IS NOT NULL
);

-- ============================================
-- Phase 1.6: Create helper functions
-- ============================================

-- Function to get album for a specific date with tracks
CREATE OR REPLACE FUNCTION public.get_album_for_date(target_date DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'album', json_build_object(
      'id', sa.id,
      'spotify_album_id', sa.spotify_album_id,
      'album_name', sa.album_name,
      'artist_name', sa.artist_name,
      'artwork_url', sa.artwork_url,
      'track_count', sa.track_count,
      'scheduled_date', sa.scheduled_date,
      'status', sa.status
    ),
    'tracks', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', sat.id,
          'spotify_track_id', sat.spotify_track_id,
          'track_name', sat.track_name,
          'artist_name', sat.artist_name,
          'track_number', sat.track_number,
          'duration_ms', sat.duration_ms,
          'artwork_url', sat.artwork_url,
          'preview_url', sat.preview_url,
          'spotify_url', sat.spotify_url
        ) ORDER BY sat.track_number
      ), '[]'::json)
      FROM public.scheduled_album_tracks sat
      WHERE sat.scheduled_album_id = sa.id
    )
  ) INTO result
  FROM public.scheduled_albums sa
  WHERE sa.scheduled_date = target_date;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_album_for_date(DATE) TO anon;
GRANT EXECUTE ON FUNCTION public.get_album_for_date(DATE) TO authenticated;

COMMENT ON FUNCTION public.get_album_for_date IS 'Returns the scheduled album and its tracks for a given date as JSON. Returns NULL if no album is scheduled.';

-- Function to get vote counts for scheduled tracks
CREATE OR REPLACE FUNCTION public.get_scheduled_track_votes(p_scheduled_date DATE)
RETURNS TABLE (
  track_id UUID,
  vote_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sv.scheduled_track_id as track_id,
    COUNT(*)::BIGINT as vote_count
  FROM public.song_votes sv
  WHERE sv.scheduled_date = p_scheduled_date
    AND sv.scheduled_track_id IS NOT NULL
  GROUP BY sv.scheduled_track_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_scheduled_track_votes(DATE) TO anon;
GRANT EXECUTE ON FUNCTION public.get_scheduled_track_votes(DATE) TO authenticated;

COMMENT ON FUNCTION public.get_scheduled_track_votes IS 'Returns vote counts for all tracks on a given scheduled date';
