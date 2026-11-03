import { NavShell } from '@/layouts/NavShell';
import { TUTOR_GROUPS } from '@/components/layout/NavRail';

export default function TutorLayout() {
  return <NavShell groups={TUTOR_GROUPS} homePath="/tutor" themeToggle />;
}
