import { NavShell } from '@/layouts/NavShell';
import { ADMIN_GROUPS } from '@/components/layout/NavRail';

export default function DashboardLayout() {
  return <NavShell groups={ADMIN_GROUPS} />;
}
