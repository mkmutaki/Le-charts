
-- Create storage bucket for album covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('album_covers', 'album_covers', true);

-- Create storage policies for album covers bucket
CREATE POLICY "Anyone can view album covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'album_covers');

CREATE POLICY "Admins can upload album covers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'album_covers' AND
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.id = auth.uid() 
    AND user_roles.is_admin = true
  )
);

CREATE POLICY "Admins can update album covers"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'album_covers' AND
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.id = auth.uid() 
    AND user_roles.is_admin = true
  )
);

CREATE POLICY "Admins can delete album covers"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'album_covers' AND
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.id = auth.uid() 
    AND user_roles.is_admin = true
  )
);

-- Create table to store current album cover setting
CREATE TABLE public.puzzle_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  current_album_cover_url TEXT NOT NULL,
  album_title TEXT,
  album_artist TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default album cover (current Kanye West - Graduation)
INSERT INTO public.puzzle_settings (
  current_album_cover_url,
  album_title,
  album_artist
) VALUES (
  'https://upload.wikimedia.org/wikipedia/en/7/70/Graduation_%28album%29.jpg',
  'Graduation',
  'Kanye West'
);

-- Enable RLS on puzzle_settings
ALTER TABLE public.puzzle_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for puzzle_settings
CREATE POLICY "Anyone can view puzzle settings"
ON public.puzzle_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can update puzzle settings"
ON public.puzzle_settings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.id = auth.uid() 
    AND user_roles.is_admin = true
  )
);
