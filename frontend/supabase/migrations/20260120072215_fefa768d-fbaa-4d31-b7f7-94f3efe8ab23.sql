-- Add columns to identify notification recipients
ALTER TABLE public.notifications 
ADD COLUMN target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN is_admin_notification boolean NOT NULL DEFAULT false;

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Allow public access to notifications" ON public.notifications;

-- Create policy for admins to read all notifications
-- Admins can see all notifications (admin notifications and any notification)
CREATE POLICY "Admins can read all notifications"
ON public.notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
  OR is_admin_notification = true
);

-- Create policy for regular users to read only their own notifications
CREATE POLICY "Users can read their own notifications"
ON public.notifications
FOR SELECT
USING (
  target_user_id = auth.uid()
  AND is_admin_notification = false
);

-- Create policy for admins to insert notifications
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Create policy for system to insert notifications (for triggers/functions)
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create policy for admins to update notifications (mark as read, etc.)
CREATE POLICY "Admins can update notifications"
ON public.notifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Create policy for users to update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (target_user_id = auth.uid());

-- Create policy for admins to delete notifications
CREATE POLICY "Admins can delete notifications"
ON public.notifications
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);