-- Fix security vulnerability: Remove overly permissive RLS policy that exposes admin user IDs
-- The current "Allow access via is_admin function" policy with expression 'true' 
-- allows anyone to read all user roles, exposing admin accounts to attackers

-- Drop the problematic policy that allows public read access
DROP POLICY IF EXISTS "Allow access via is_admin function" ON public.user_roles;

-- The remaining policies are secure:
-- 1. "Users can read their own role" - users can only see their own role
-- 2. "Users can view their own roles" - duplicate but also secure
-- The is_admin() function will still work because it uses SECURITY DEFINER
-- which bypasses RLS and runs with elevated privileges