import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userRole: 'admin' | 'client' | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; role: 'admin' | 'client' | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Check if Supabase is properly configured (not using dummy values)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const isSupabaseConfigured = SUPABASE_URL && !SUPABASE_URL.includes('dummy') && supabase;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'client' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Use ref to track last fetched user ID to prevent stale closure issues
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const fetchUserRole = useCallback(async (userId: string): Promise<'admin' | 'client' | null> => {
    if (!isSupabaseConfigured) return null;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] Error fetching user role:', error);
        return null;
      }

      return (data?.role as 'admin' | 'client') || null;
    } catch (err) {
      console.error('[AuthContext] Error fetching user role:', err);
      return null;
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: Error | null; role: 'admin' | 'client' | null }> => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase not configured - use backend auth'), role: null };
    }
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error, role: null };
      }
      if (data.session?.user?.id) {
        const userId = data.session.user.id;
        // Claim this user ID so onAuthStateChange won't double-fetch
        lastFetchedUserIdRef.current = userId;
        const role = await fetchUserRole(userId);
        setSession(data.session);
        setUserRole(role);
        return { error: null, role };
      }
      return { error: null, role: null };
    } catch (err) {
      return { error: err as Error, role: null };
    }
  }, [fetchUserRole]);

  const signOut = useCallback(async () => {
    // Clear state FIRST
    setSession(null);
    setUserRole(null);
    lastFetchedUserIdRef.current = null;
    
    // Then sign out from Supabase (if configured)
    if (isSupabaseConfigured) {
      await supabase.auth.signOut({ scope: 'global' });
    }
    
    // Navigate after state is cleared
    navigate('/', { replace: true });
  }, [navigate]);

  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Password reset not available') };
    }
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        return { error };
      }
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Password update not available') };
    }
    
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        return { error };
      }
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  }, []);

  useEffect(() => {
    // Skip Supabase initialization if using dummy/backend-only auth
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    let initializationComplete = false;

    const initialize = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AuthContext] Session error:', error);
          if (mounted) {
            setIsLoading(false);
            initializationComplete = true;
          }
          return;
        }

        if (currentSession?.user?.id) {
          // Set session + stop loading IMMEDIATELY so ProtectedRoute/ClientRoute
          // see an authenticated user right away. Role fetch continues in background.
          if (mounted) {
            setSession(currentSession);
            lastFetchedUserIdRef.current = currentSession.user.id;
            setIsLoading(false);
            initializationComplete = true;
          }

          // Fetch role in background — ProtectedRoute shows a spinner until
          // userRole is populated.
          const role = await fetchUserRole(currentSession.user.id);
          if (mounted) {
            setUserRole(role);
          }
        } else {
          if (mounted) {
            setSession(null);
            setUserRole(null);
            setIsLoading(false);
            initializationComplete = true;
          }
        }
      } catch (err) {
        console.error('[AuthContext] Initialization error:', err);
        if (mounted) {
          setIsLoading(false);
          initializationComplete = true;
        }
      }
    };

    // Initialize immediately
    initialize();

    // Safety timeout - never stay loading forever
    const timeoutId = setTimeout(() => {
      if (mounted && !initializationComplete) {
        setIsLoading(false);
      }
    }, 5000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUserRole(null);
        lastFetchedUserIdRef.current = null;
        setIsLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' && currentSession?.user?.id) {
        // Skip if initialize() already fetched the role for this user
        if (lastFetchedUserIdRef.current === currentSession.user.id) {
          if (mounted) {
            setSession(currentSession);
            setIsLoading(false);
          }
          return;
        }
        // Set session immediately, then fetch role
        if (mounted) setSession(currentSession);
        const role = await fetchUserRole(currentSession.user.id);
        if (mounted) {
          setUserRole(role);
          lastFetchedUserIdRef.current = currentSession.user.id;
          setIsLoading(false);
        }
        return;
      }

      if (event === 'TOKEN_REFRESHED' && currentSession) {
        setSession(currentSession);
      }

      if (event === 'PASSWORD_RECOVERY') {
        setSession(currentSession);
        navigate('/reset-password', { replace: true });
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchUserRole, navigate]);

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user || null,
      userRole,
      isLoading,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
