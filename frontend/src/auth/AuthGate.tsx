import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function AuthGate({ protectedRoute = false }: { protectedRoute?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <main className="grid min-h-svh place-items-center p-6"><p role="status">Checking your session…</p></main>;
  if (protectedRoute && !user) return <Navigate to="/login" replace />;
  if (!protectedRoute && user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
