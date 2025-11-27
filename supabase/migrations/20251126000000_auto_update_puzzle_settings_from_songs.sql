-- Migration: Auto-update puzzle_settings when songs are inserted/deleted
-- This trigger automatically syncs the puzzle game cover with the current album

-- Create a function that updates puzzle_settings from the first song in LeSongs
CREATE OR REPLACE FUNCTION update_puzzle_settings_from_songs()
RETURNS TRIGGER AS $$
DECLARE
  first_song RECORD;
BEGIN
  -- Get the first song from LeSongs (by track_number or created_at)
  SELECT cover_url, album_name, artist 
  INTO first_song
  FROM "LeSongs" 
  WHERE cover_url IS NOT NULL 
    AND album_name IS NOT NULL
  ORDER BY track_number ASC NULLS LAST, created_at ASC 
  LIMIT 1;
  
  -- If we found a song with the required data, update puzzle_settings
  IF first_song IS NOT NULL AND first_song.cover_url IS NOT NULL THEN
    UPDATE puzzle_settings
    SET 
      current_album_cover_url = first_song.cover_url,
      album_title = first_song.album_name,
      album_artist = first_song.artist,
      updated_at = NOW()
    WHERE id = (SELECT id FROM puzzle_settings LIMIT 1);
    
    -- If no row exists in puzzle_settings, insert one
    IF NOT FOUND THEN
      INSERT INTO puzzle_settings (current_album_cover_url, album_title, album_artist)
      VALUES (first_song.cover_url, first_song.album_name, first_song.artist);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after INSERT on LeSongs
DROP TRIGGER IF EXISTS trigger_update_puzzle_settings_on_insert ON "LeSongs";
CREATE TRIGGER trigger_update_puzzle_settings_on_insert
  AFTER INSERT ON "LeSongs"
  FOR EACH STATEMENT
  EXECUTE FUNCTION update_puzzle_settings_from_songs();

-- Create trigger that fires after DELETE on LeSongs (to handle when all songs are deleted and new ones added)
DROP TRIGGER IF EXISTS trigger_update_puzzle_settings_on_delete ON "LeSongs";
CREATE TRIGGER trigger_update_puzzle_settings_on_delete
  AFTER DELETE ON "LeSongs"
  FOR EACH STATEMENT
  EXECUTE FUNCTION update_puzzle_settings_from_songs();
