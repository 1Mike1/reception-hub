import { Navigate, useLocation } from 'react-router-dom';
import { getAdminSession } from '@/services/adminAuth';
import { getClientSession } from '@/services/clientAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'client';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const location = useLocation();
  const adminSession = getAdminSession();
  const clientSession = getClientSession();

  // Determine current role
  const currentRole = adminSession ? 'admin' : clientSession ? 'client' : null;

  // No session at all → go to login
  if (!currentRole) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Wrong role → redirect to correct destination
  if (requiredRole && currentRole !== requiredRole) {
    if (currentRole === 'admin') return <Navigate to="/admin" replace />;
    if (currentRole === 'client') return <Navigate to="/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
