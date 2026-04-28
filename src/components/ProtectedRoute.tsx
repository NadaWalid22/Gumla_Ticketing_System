import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireManager?: boolean;
}

export default function ProtectedRoute({ children, requireManager = false }: ProtectedRouteProps) {
  const { user, profile, loading, isManagerOrSupport } = useAuth();

  if (loading) {
    return <div className="center-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return <div className="center-screen">Preparing your profile...</div>;
  }

  if (requireManager && !isManagerOrSupport) {
    return <Navigate to="/" replace />;
  }

  return children;
}
