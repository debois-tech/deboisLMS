import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, ClipboardCheck, LibraryBig, MessageSquare, Wallet, type LucideIcon } from 'lucide-react';
import { CLAIMS_CHANGED, getAllPendingClaims } from '@/lib/supabase/queries/paymentClaims';
import {
  NOTICES_CHANGED,
  clearFailures,
  getAllFeedback,
  getExpiringStudents,
  getFailures,
  getPendingCurriculum,
  getTutorDashboardStats,
  type FailureKind,
} from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency, formatDate, timeAgo } from '@/lib/utils/format';

export interface NoticeRow {
  key: string;
  primary: string;
  meta?: string[];
  to?: string;
}

export interface Notice {
  id: string;
  icon: LucideIcon;
  tone: 'warning' | 'error' | 'info';
  title: string;
  count: number;
  rows: NoticeRow[];
  // Where View goes when there is no list to show
  to?: string;
  clear?: () => Promise<void>;
}

const POLL_MS = 60_000;

const FAILURE_LABELS: Record<FailureKind, string> = {
  cleanup: 'Clean-up',
  document_email: 'Document email',
  csv_import: 'CSV import',
  login_create: 'Login',
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// A source that fails (a migration not run yet, say) must not take the others down
const safely = <T,>(load: Promise<T[]>) => load.catch((err) => {
  console.error('[notices]', err);
  return [] as T[];
});

async function adminNotices(): Promise<Notice[]> {
  const [claims, expiring, feedback, curriculum, failures] = await Promise.all([
    safely(getAllPendingClaims()),
    safely(getExpiringStudents()),
    safely(getAllFeedback()),
    safely(getPendingCurriculum()),
    safely(getFailures()),
  ]);
  const open = feedback.filter((report) => report.status === 'open');

  const all: Notice[] = [
    {
      id: 'claims', icon: Wallet, tone: 'warning', count: claims.length,
      title: `${plural(claims.length, 'payment claim', 'payment claims')} to verify`,
      rows: claims.map((claim) => ({
        key: claim.id,
        primary: `${claim.student?.name ?? 'Student'} · ${formatCurrency(Number(claim.amount))}`,
        to: `/students/${claim.student_id}`,
      })),
    },
    {
      id: 'expiring', icon: CalendarClock, tone: 'warning', count: expiring.length,
      title: `${plural(expiring.length, 'account', 'accounts')} expiring soon`,
      rows: expiring.map((student) => ({
        key: student.student_id,
        primary: `${student.student_name} (${student.student_code})`,
        meta: [
          student.batch_name && student.ended_on ? `${student.batch_name} ended ${formatDate(student.ended_on)}` : 'No batch',
          `Login and documents go ${formatDate(student.delete_on)}`,
          student.owed > 0 ? `${formatCurrency(student.owed)} unpaid` : 'Nothing unpaid',
          `Documents: ${student.docs_made} of 2 made, ${student.docs_shared} shared`,
        ],
        to: `/students/${student.student_id}`,
      })),
    },
    {
      id: 'feedback', icon: MessageSquare, tone: 'info', count: open.length,
      title: `${plural(open.length, 'feedback report', 'feedback reports')} open`,
      rows: open.map((report) => ({
        key: report.id,
        primary: report.student?.name ?? 'Student',
        meta: [report.message.length > 90 ? `${report.message.slice(0, 90)}…` : report.message],
        to: '/feedback',
      })),
    },
    {
      id: 'curriculum', icon: LibraryBig, tone: 'info', count: curriculum.length,
      title: `${plural(curriculum.length, 'curriculum submission', 'curriculum submissions')} to approve`,
      rows: curriculum.map((item) => ({ key: item.batch_id, primary: item.name, to: `/curriculum/${item.batch_id}` })),
    },
    {
      id: 'failures', icon: AlertTriangle, tone: 'error', count: failures.length,
      title: plural(failures.length, 'action failed', 'actions failed'),
      rows: failures.map((failure) => ({
        key: failure.id,
        primary: failure.detail,
        meta: [FAILURE_LABELS[failure.kind], timeAgo(failure.created_at)],
      })),
      clear: clearFailures,
    },
  ];
  return all.filter((notice) => notice.count > 0);
}

async function tutorNotices(): Promise<Notice[]> {
  const [stats, curriculum] = await Promise.all([
    getTutorDashboardStats().catch(() => null),
    safely(getPendingCurriculum()),
  ]);
  const grading = stats?.pending_grading ?? 0;

  const all: Notice[] = [
    {
      id: 'grading', icon: ClipboardCheck, tone: 'info', count: grading,
      title: `${plural(grading, 'submission', 'submissions')} to grade`,
      rows: [], to: '/tutor/assignments',
    },
    {
      id: 'curriculum', icon: LibraryBig, tone: 'info', count: curriculum.length,
      title: `${plural(curriculum.length, 'curriculum submission', 'curriculum submissions')} waiting`,
      rows: curriculum.map((item) => ({ key: item.batch_id, primary: item.name, to: `/tutor/curriculum/${item.batch_id}` })),
    },
  ];
  return all.filter((notice) => notice.count > 0);
}

// What the signed-in admin or tutor should know about, refreshed every minute and when something changes
export function useNotices(): Notice[] {
  const { isAdmin, isTutor } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    if (!isAdmin && !isTutor) return;
    let live = true;
    const load = () => (isAdmin ? adminNotices() : tutorNotices()).then((next) => { if (live) setNotices(next); }).catch(console.error);
    load();
    const timer = setInterval(load, POLL_MS);
    window.addEventListener(CLAIMS_CHANGED, load);
    window.addEventListener(NOTICES_CHANGED, load);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener(CLAIMS_CHANGED, load);
      window.removeEventListener(NOTICES_CHANGED, load);
    };
  }, [isAdmin, isTutor]);

  return notices;
}
