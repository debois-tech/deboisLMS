import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/context/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import type { Role } from '@/lib/types';

/** Where each role lands when it hits a route it isn't allowed on. */
const homeForRole: Record<Role, string> = {
  admin: '/',
  developer: '/',
  student: '/portal',
  tutor: '/tutor',
};

/** `admin` routes admit the developer too; `developer` routes are theirs alone. */
export default function ProtectedRoute({ role = 'admin' }: { role?: Role }) {
  const { user, loading } = useAuth();

  if (loading) return <Spinner centered />;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (user.role !== role && !(role === 'admin' && user.role === 'developer')) return <Navigate to={homeForRole[user.role]} replace />;

  return <Outlet />;
}
