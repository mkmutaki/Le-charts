
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

