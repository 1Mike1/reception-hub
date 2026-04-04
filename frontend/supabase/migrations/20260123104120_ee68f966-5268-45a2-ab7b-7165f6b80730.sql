-- Create clients table for storing client profile data
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  service_area TEXT,
  subscription_plan TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_id UNIQUE (user_id)
);

-- Enable Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Clients can read their own profile
CREATE POLICY "Users can read their own client profile" 
ON public.clients 
FOR SELECT 
USING (user_id = auth.uid());

-- Clients can update their own profile (for non-sensitive fields)
CREATE POLICY "Users can update their own client profile" 
ON public.clients 
FOR UPDATE 
USING (user_id = auth.uid());

-- Admins can read all client profiles
CREATE POLICY "Admins can read all client profiles" 
ON public.clients 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert client profiles
CREATE POLICY "Admins can insert client profiles" 
ON public.clients 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all client profiles
CREATE POLICY "Admins can update all client profiles" 
ON public.clients 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete client profiles
CREATE POLICY "Admins can delete client profiles" 
ON public.clients 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for clients table
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;