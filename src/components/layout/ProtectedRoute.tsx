import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/context/AuthContext';
import { Spinner } from '@/components/ui/Spinner';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner centered />;
  if (!user) return <Navigate to="/auth/login" replace />;

  return <Outlet />;
}
