
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

-- Simple function to increment a value by 1
CREATE OR REPLACE FUNCTION public.increment(x integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE STRICT
AS $$
  SELECT $1 + 1;
$$;
