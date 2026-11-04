import { NavShell } from '@/layouts/NavShell';
import { ADMIN_GROUPS, ADMIN_NEW } from '@/components/layout/NavRail';

export default function DashboardLayout() {
  return <NavShell groups={ADMIN_GROUPS} newAction={ADMIN_NEW} />;
}
