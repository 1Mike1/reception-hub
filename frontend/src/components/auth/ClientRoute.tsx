import { Navigate } from 'react-router-dom';
import { getClientSession } from '@/services/clientAuth';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Route guard for the client dashboard.
 * Accepts either:
 *  - A valid localStorage client session (JSON-based auth), OR
 *  - A Supabase session with 'client' role (for future Supabase-linked clients)
 */
export function ClientRoute({ children }: { children: React.ReactNode }) {
  const { session, userRole, isLoading } = useAuth();

  // Still initialising Supabase auth — wait
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Supabase client session
  if (session && userRole === 'client') {
    return <>{children}</>;
  }

  // JSON-based client session
  if (getClientSession()) {
    return <>{children}</>;
  }

  return <Navigate to="/" replace />;
}
