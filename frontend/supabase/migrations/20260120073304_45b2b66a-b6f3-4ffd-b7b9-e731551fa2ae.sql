-- =====================
-- PROFILE_UPDATES TABLE
-- =====================

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Allow public access to profile_updates" ON public.profile_updates;

-- Allow users to submit their own profile updates
CREATE POLICY "Users can submit their own profile updates"
ON public.profile_updates
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid()::text = client_id
);

-- Allow users to read only their own profile updates
CREATE POLICY "Users can read their own profile updates"
ON public.profile_updates
FOR SELECT
USING (auth.uid()::text = client_id);

-- Allow admins to read all profile updates
CREATE POLICY "Admins can read all profile updates"
ON public.profile_updates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Allow admins to update profile updates (approve/reject, add notes)
CREATE POLICY "Admins can update profile updates"
ON public.profile_updates
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Allow admins to delete profile updates
CREATE POLICY "Admins can delete profile updates"
ON public.profile_updates
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- ===================================
-- SUBSCRIPTION_CHANGE_REQUESTS TABLE
-- ===================================

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Allow public access to subscription_change_requests" ON public.subscription_change_requests;

-- Allow users to submit their own subscription change requests
CREATE POLICY "Users can submit their own subscription requests"
ON public.subscription_change_requests
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid()::text = client_id
);

-- Allow users to read only their own subscription requests
CREATE POLICY "Users can read their own subscription requests"
ON public.subscription_change_requests
FOR SELECT
USING (auth.uid()::text = client_id);

-- Allow admins to read all subscription requests
CREATE POLICY "Admins can read all subscription requests"
ON public.subscription_change_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Allow admins to update subscription requests (approve/reject, add notes)
CREATE POLICY "Admins can update subscription requests"
ON public.subscription_change_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Allow admins to delete subscription requests
CREATE POLICY "Admins can delete subscription requests"
ON public.subscription_change_requests
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);