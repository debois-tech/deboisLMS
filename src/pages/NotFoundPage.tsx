import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/lib/context/AuthContext';

/**
 * Rendered by the catch-all routes. Without it an unmatched URL matches no route
 * at all and React Router renders nothing — a blank white page.
 */
export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const home = user?.role === 'student' ? '/portal' : '/';
  const label = user?.role === 'student' ? 'Go to your portal' : 'Go to the dashboard';

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<Compass size={26} />}
        title="Page not found"
        action={{ label, onClick: () => navigate(home, { replace: true }) }}
      />
    </div>
  );
}
