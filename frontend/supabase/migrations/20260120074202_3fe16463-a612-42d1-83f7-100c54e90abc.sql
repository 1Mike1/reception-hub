-- Fix the flawed admin notifications RLS policy
-- The current policy allows ANY authenticated user to read admin notifications
-- due to the OR is_admin_notification = true clause

DROP POLICY IF EXISTS "Admins can read all notifications" ON public.notifications;

CREATE POLICY "Admins can read all notifications"
ON public.notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);