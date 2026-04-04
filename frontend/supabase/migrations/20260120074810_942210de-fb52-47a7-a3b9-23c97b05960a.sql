-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'client');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid REFERENCES auth.users(id),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create a security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles table
-- Users can only read their own roles
CREATE POLICY "Users can read their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

-- Only admins can insert new roles
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update roles
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete roles
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- Update all existing RLS policies to use has_role function
-- =====================================================

-- NOTIFICATIONS TABLE
DROP POLICY IF EXISTS "Admins can read all notifications" ON public.notifications;
CREATE POLICY "Admins can read all notifications"
ON public.notifications
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update notifications" ON public.notifications;
CREATE POLICY "Admins can update notifications"
ON public.notifications
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
CREATE POLICY "Admins can delete notifications"
ON public.notifications
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- USER_FEEDBACK TABLE
DROP POLICY IF EXISTS "Admins can read all user feedback" ON public.user_feedback;
CREATE POLICY "Admins can read all user feedback"
ON public.user_feedback
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update user feedback" ON public.user_feedback;
CREATE POLICY "Admins can update user feedback"
ON public.user_feedback
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete user feedback" ON public.user_feedback;
CREATE POLICY "Admins can delete user feedback"
ON public.user_feedback
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- PROFILE_UPDATES TABLE
DROP POLICY IF EXISTS "Admins can read all profile updates" ON public.profile_updates;
CREATE POLICY "Admins can read all profile updates"
ON public.profile_updates
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update profile updates" ON public.profile_updates;
CREATE POLICY "Admins can update profile updates"
ON public.profile_updates
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete profile updates" ON public.profile_updates;
CREATE POLICY "Admins can delete profile updates"
ON public.profile_updates
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- SUBSCRIPTION_CHANGE_REQUESTS TABLE
DROP POLICY IF EXISTS "Admins can read all subscription requests" ON public.subscription_change_requests;
CREATE POLICY "Admins can read all subscription requests"
ON public.subscription_change_requests
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update subscription requests" ON public.subscription_change_requests;
CREATE POLICY "Admins can update subscription requests"
ON public.subscription_change_requests
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete subscription requests" ON public.subscription_change_requests;
CREATE POLICY "Admins can delete subscription requests"
ON public.subscription_change_requests
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create a function to auto-assign 'client' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Default new users to 'client' role unless they have admin in metadata
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'::app_role
      ELSE 'client'::app_role
    END
  );
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign role on user creation
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();