-- Fix voting functionality by adding missing permissions and updating RLS policies
-- This fixes the 403 Forbidden error when anonymous users try to vote

-- Step 1: Grant necessary permissions to anon role for voting
GRANT SELECT, INSERT ON public.song_votes TO anon;

-- Step 2: Grant permissions to authenticated role (for admins and logged-in users)
GRANT SELECT, INSERT, DELETE ON public.song_votes TO authenticated;

-- Step 3: Drop the old DELETE policy that checks ip_address (which we don't use anymore)
DROP POLICY IF EXISTS "Allow users to delete their own votes" ON public.song_votes;

-- Step 4: Create new DELETE policy that allows admins to delete votes
CREATE POLICY "Allow admins to delete votes"
ON public.song_votes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.jwt() ->> 'sub'
    AND user_roles.is_admin = true
  )
);

-- Step 5: Remove duplicate SELECT policy (we already have "Anyone can read song votes")
DROP POLICY IF EXISTS "Allow anonymous users to view votes" ON public.song_votes;

-- Note: The existing policies remain:
-- - "Allow anonymous users to insert votes" (INSERT for anon)
-- - "Anyone can read song votes" (SELECT for anon and authenticated)
-- - "Allow admins to delete votes" (DELETE for authenticated admins only)
