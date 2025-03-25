
-- This function checks if a user is an admin by looking up in the user_roles table
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = $1
    AND is_admin = true
  );
$$;

-- Function to check how many votes an IP address has used
CREATE OR REPLACE FUNCTION public.get_ip_vote_count(ip_addr TEXT)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT COUNT(*) FROM public.song_votes WHERE ip_address = ip_addr;
$$;

-- Function to check if a vote already exists for a device/song/IP combination
CREATE OR REPLACE FUNCTION public.has_voted_for_song(device_id_param TEXT, song_id_param INTEGER, ip_param TEXT)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM song_votes
    WHERE (device_id = device_id_param OR ip_address = ip_param)
    AND song_id = song_id_param
  );
$$;
