import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ClientProfile {
  id: string;
  user_id: string;
  company_name: string;
  business_email: string;
  service_area: string | null;
  subscription_plan: string;
  status: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientProfile() {
  const { user, userRole } = useAuth();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id || userRole !== 'client') {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('[useClientProfile] Error fetching profile:', fetchError);
        setError(fetchError.message);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('[useClientProfile] Unexpected error:', err);
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userRole]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!user?.id || userRole !== 'client') return;

    const channel = supabase
      .channel('client-profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useClientProfile] Realtime update:', payload);
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setProfile(payload.new as ClientProfile);
          } else if (payload.eventType === 'DELETE') {
            setProfile(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, userRole]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    fetchProfile();
  }, [fetchProfile]);

  return { profile, isLoading, error, refetch };
}
