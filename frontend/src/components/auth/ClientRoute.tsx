import { Navigate } from 'react-router-dom';
import { getClientSession } from '@/services/clientAuth';

/**
 * Route guard for the client dashboard.
 * Accepts a valid localStorage client session (backend JSON/MongoDB auth).
 */
export function ClientRoute({ children }: { children: React.ReactNode }) {
  // Check localStorage for client session
  if (getClientSession()) {
    return <>{children}</>;
  }

  return <Navigate to="/" replace />;
}
