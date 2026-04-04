-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Allow public access to user_feedback" ON public.user_feedback;

-- Allow authenticated users to insert their own feedback
-- The client_id must match the authenticated user's ID
CREATE POLICY "Users can submit their own feedback"
ON public.user_feedback
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid()::text = client_id
);

-- Allow users to read only their own feedback
CREATE POLICY "Users can read their own feedback"
ON public.user_feedback
FOR SELECT
USING (
  auth.uid()::text = client_id
);

-- Allow admins to read all feedback
CREATE POLICY "Admins can read all feedback"
ON public.user_feedback
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Allow admins to update feedback (status, notes, clarity requests, etc.)
CREATE POLICY "Admins can update feedback"
ON public.user_feedback
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Allow users to update their own feedback (e.g., respond to clarity requests)
CREATE POLICY "Users can update their own feedback"
ON public.user_feedback
FOR UPDATE
USING (auth.uid()::text = client_id);

-- Allow admins to delete feedback
CREATE POLICY "Admins can delete feedback"
ON public.user_feedback
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);