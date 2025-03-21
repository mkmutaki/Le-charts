
-- This is just for reference, will be executed in a separate SQL block
CREATE OR REPLACE FUNCTION public.decrement(x integer)
RETURNS integer
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT GREATEST(0, $1 - 1);
$$;
