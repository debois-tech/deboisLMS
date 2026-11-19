import { NavShell } from '@/layouts/NavShell';
import { TUTOR_GROUPS } from '@/components/layout/NavRail';
import { LoginIntro } from '@/components/layout/LoginIntro';

export default function TutorLayout() {
  return (
    <>
      <NavShell groups={TUTOR_GROUPS} homePath="/tutor" themeToggle />
      <LoginIntro />
    </>
  );
}
