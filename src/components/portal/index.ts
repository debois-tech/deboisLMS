/**
 * The student portal widget kit. Portal pages import from here and nowhere else,
 * so every page inherits the same spacing, wording and states for free.
 *
 * Building a new portal page — see ./README.md for the full recipe:
 *   1. route under /portal in App.tsx + an entry in portalNavItems
 *   2. `const studentId = usePortalStudentId()`
 *   3. wrap in <PortalPage title="…" loading={…}>
 *   4. compose the body from PortalFocus / PortalStatGrid / PortalSection /
 *      PortalList / PortalRow / PortalStatus / PortalEmpty
 */
export { PortalPage, PortalLoading, usePortalStudentId } from './PortalPage';
export { PortalSection } from './PortalSection';
export { PortalFocus } from './PortalFocus';
export { PortalStat, PortalStatGrid } from './PortalStat';
export { PortalList, PortalRow } from './PortalList';
export { PortalStatus, statusLabel } from './PortalStatus';
export { PortalEmpty } from './PortalEmpty';
export { AssignmentModal } from './AssignmentModal';
export type { StudentAssignment } from './AssignmentModal';
export { MaterialViewer } from './MaterialViewer';
