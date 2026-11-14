import { NavShell } from '@/layouts/NavShell';
import { ADMIN_GROUPS, DEV_GROUPS } from '@/components/layout/NavRail';
import { useAuth } from '@/lib/context/AuthContext';

export default function DashboardLayout() {
  const { isDeveloper } = useAuth();
  return <NavShell groups={isDeveloper ? DEV_GROUPS : ADMIN_GROUPS} />;
}
