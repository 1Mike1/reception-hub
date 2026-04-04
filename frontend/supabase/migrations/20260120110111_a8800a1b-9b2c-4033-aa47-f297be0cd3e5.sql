-- Drop the old RLS policies that reference auth.users table (causing permission denied errors)
DROP POLICY IF EXISTS "Admins can read all feedback" ON public.user_feedback;
DROP POLICY IF EXISTS "Admins can update feedback" ON public.user_feedback;
DROP POLICY IF EXISTS "Admins can delete feedback" ON public.user_feedback;