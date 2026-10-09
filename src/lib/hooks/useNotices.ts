import { useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRightLeft, Award, BookOpen, CalendarClock, CheckCircle2, ClipboardCheck, ClipboardList, FileText, Flag,
  LibraryBig, MessageSquare, Trophy, UserPlus, Wallet, type LucideIcon,
} from 'lucide-react';
import { CLAIMS_CHANGED, getAllPendingClaims } from '@/lib/supabase/queries/paymentClaims';
import {
  NOTICES_CHANGED,
  clearFailures,
  getAssignmentsForStudent,
  getBadgeTasks,
  getExpiringStudents,
  getFailures,
  getMyFeeDues,
  getPendingCurriculum,
  getStudentBatches,
  getTutorDashboardStats,
  type FailureKind,
} from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import type { BadgeTask } from '@/lib/supabase';
import type { NotificationKind, NotificationRow } from '@/lib/types';
import { assignmentState } from '@/lib/utils/deadline';
import { addDays, countsFor, fromDateValue, toDateValue } from '@/lib/utils/date';
import { formatCurrency, formatDate, timeAgo } from '@/lib/utils/format';
import { dueInstallment, installmentDetail, installmentLabel } from '@/lib/utils/installments';

export interface NoticeRow {
  key: string;
  primary: string;
  meta?: string[];
  to?: string;
}

export interface Notice {
  id: string;
  icon: LucideIcon;
  tone: 'warning' | 'error' | 'info' | 'success';
  title: string;
  detail?: string;
  // Which batch it is about, when the person is in more than one
  batch?: string;
  // The same batch by id, so opening it can switch a student's portal to it
  batchId?: string;
  count: number;
  rows: NoticeRow[];
  // Where it leads; with none, a list of its rows opens
  to?: string;
  clear?: () => Promise<void>;
  // A live count of work waiting: collapsible, never closed, gone once the work is done
  action?: boolean;
  // Stored events: the rows behind it, and whether all are read
  ids?: string[];
  read?: boolean;
  at?: string;
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
  const [claims, expiring, curriculum, failures] = await Promise.all([
    safely(getAllPendingClaims()),
    safely(getExpiringStudents()),
    safely(getPendingCurriculum()),
    safely(getFailures()),
  ]);

  const all: Notice[] = [
    {
      id: 'claims', icon: Wallet, tone: 'warning', action: true, count: claims.length,
      title: `${plural(claims.length, 'payment claim', 'payment claims')} to verify`,
      rows: claims.map((claim) => ({
        key: claim.id,
        primary: `${claim.student?.name ?? 'Student'} · ${formatCurrency(Number(claim.amount))}`,
        to: `/students/${claim.student_id}`,
      })),
    },
    {
      id: 'expiring', icon: CalendarClock, tone: 'warning', action: true, count: expiring.length,
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
      id: 'curriculum', icon: LibraryBig, tone: 'info', action: true, count: curriculum.length,
      title: `${plural(curriculum.length, 'curriculum submission', 'curriculum submissions')} to approve`,
      rows: curriculum.map((item) => ({ key: item.batch_id, primary: item.name, to: `/curriculum/${item.batch_id}` })),
    },
    {
      id: 'failures', icon: AlertTriangle, tone: 'error', action: true, count: failures.length,
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
  const [stats, curriculum, tasks] = await Promise.all([
    getTutorDashboardStats().catch(() => null),
    safely(getPendingCurriculum()),
    safely(getBadgeTasks()),
  ]);
  const grading = stats?.pending_grading ?? 0;
  // One task per badge, naming the cards that earned it
  const byBadge = new Map<string, BadgeTask[]>();
  for (const task of tasks) byBadge.set(task.badge_id, [...(byBadge.get(task.badge_id) ?? []), task]);

  const all: Notice[] = [
    {
      id: 'grading', icon: ClipboardCheck, tone: 'info', action: true, count: grading,
      title: `${plural(grading, 'submission', 'submissions')} to grade`,
      rows: [], to: '/tutor/assignments',
    },
    {
      id: 'badges', icon: Award, tone: 'info', action: true, count: byBadge.size,
      title: `${plural(byBadge.size, 'badge', 'badges')} to award`,
      rows: [...byBadge.values()].map(([first, ...more]) => ({
        key: first.badge_id,
        primary: first.badge_name,
        meta: [first.batch_name, [first, ...more].map((task) => task.node_title).join(' · ')],
        to: `/tutor/batches/${first.batch_id}?tab=badges&award=${first.badge_id}`,
      })),
    },
    {
      id: 'curriculum', icon: LibraryBig, tone: 'info', count: curriculum.length,
      title: `${plural(curriculum.length, 'curriculum submission', 'curriculum submissions')} waiting`,
      rows: curriculum.map((item) => ({ key: item.batch_id, primary: item.name, to: `/tutor/curriculum/${item.batch_id}` })),
    },
  ];
  return all.filter((notice) => notice.count > 0);
}

// Work to hand in is the one live card a student cannot close; a due instalment and a closing account can be
async function studentNotices(studentId: string): Promise<Notice[]> {
  const [mappings, work, fees] = await Promise.all([
    getStudentBatches(studentId),
    safely(getAssignmentsForStudent(studentId)),
    safely(getMyFeeDues()),
  ]);
  const now = Date.now();
  const active = mappings.filter((m) => m.status === 'active' && m.batch && !m.batch.is_test);
  const running = active.filter((m) => !m.batch?.ended_at);
  const all: Notice[] = [];

  for (const m of running) {
    const batch = running.length > 1 ? m.batch?.name : undefined;
    const todo = work.filter(
      (item) => item.batch_id === m.batch_id && countsFor(item.assigned_date ?? item.created_at, m.joined_at, m.count_earlier_work) && assignmentState(item) === 'todo',
    ).length;
    if (todo > 0) {
      all.push({ id: `todo:${m.batch_id}`, icon: ClipboardList, tone: 'info', action: true, count: todo, batch, batchId: m.batch_id, title: `${plural(todo, 'assignment', 'assignments')} to hand in`, rows: [], to: '/portal/assignments' });
    }

    const fee = fees.find((row) => row.batch_id === m.batch_id);
    const due = fee ? dueInstallment(m.joined_at, fee.paid_through ?? 0, Number(fee.amount_due), now) : null;
    if (fee && due) {
      all.push({
        id: `fee:${m.batch_id}:${due.index}`, icon: Wallet, tone: due.missed ? 'error' : 'warning', count: 1, batch, batchId: m.batch_id, rows: [], to: '/portal/profile',
        title: installmentLabel(due), detail: installmentDetail(due, Number(fee.amount_due), formatDate(due.dueDate)),
      });
    }
  }

  // With nothing running, the last batch's end starts the 90 days to close the account
  const lastEnd = active.map((m) => m.batch?.ended_at?.slice(0, 10)).filter(Boolean).sort().pop();
  const end = lastEnd ? fromDateValue(lastEnd) : null;
  if (running.length === 0 && end) {
    const closes = addDays(end, 90);
    const left = Math.round((closes.getTime() - (fromDateValue(toDateValue(new Date(now)))?.getTime() ?? now)) / 86_400_000);
    if (left >= 0 && left <= 14) {
      all.push({
        id: 'closing', icon: CalendarClock, tone: 'warning', count: 1, rows: [], to: '/portal/profile',
        title: left === 0 ? 'Account closes today' : `Account closes in ${plural(left, 'day', 'days')}`, detail: formatDate(toDateValue(closes)),
      });
    }
  }
  return all;
}

const KINDS: Record<NotificationKind, { icon: LucideIcon; tone: Notice['tone']; one: string; many: (n: number) => string }> = {
  assignment_new: { icon: ClipboardList, tone: 'info', one: 'New assignment', many: (n) => `${n} new assignments` },
  assignment_graded: { icon: CheckCircle2, tone: 'success', one: 'Assignment graded', many: (n) => `${n} assignments graded` },
  material_new: { icon: BookOpen, tone: 'info', one: 'New material', many: (n) => `${n} new materials` },
  quiz_new: { icon: Trophy, tone: 'info', one: 'New quiz', many: (n) => `${n} new quizzes` },
  quiz_result: { icon: Trophy, tone: 'success', one: 'Quiz result ready', many: (n) => `${n} quiz results ready` },
  document_shared: { icon: FileText, tone: 'success', one: 'Document shared', many: (n) => `${n} documents shared` },
  payment_verified: { icon: Wallet, tone: 'success', one: 'Payment verified', many: (n) => `${n} payments verified` },
  feedback_resolved: { icon: MessageSquare, tone: 'success', one: 'Feedback resolved', many: (n) => `${n} feedback resolved` },
  feedback_new: { icon: MessageSquare, tone: 'info', one: 'New feedback', many: (n) => `${n} new feedback reports` },
  student_transferred: { icon: ArrowRightLeft, tone: 'info', one: 'Student transferred', many: (n) => `${n} students transferred` },
  batch_ended: { icon: Flag, tone: 'info', one: 'Batch ended', many: (n) => `${n} batches ended` },
  curriculum_decided: { icon: LibraryBig, tone: 'info', one: 'Curriculum decided', many: (n) => `${n} curriculum decisions` },
  student_joined: { icon: UserPlus, tone: 'info', one: 'New student', many: (n) => `${n} new students` },
  quiz_finished: { icon: Trophy, tone: 'info', one: 'Quiz finished', many: (n) => `${n} quizzes finished` },
};

// Several of one kind in one batch are one notice, read or unread together; rows arrive newest first
export function groupNotifications(list: NotificationRow[]): Notice[] {
  const groups = new Map<string, NotificationRow[]>();
  for (const row of list) {
    const key = `${row.kind}:${row.batch_id ?? ''}:${row.read_at ? 'read' : 'new'}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups].map(([id, items]) => {
    const newest = items[0];
    const kind = KINDS[newest.kind];
    return {
      id,
      icon: kind.icon,
      tone: kind.tone,
      title: items.length === 1 ? kind.one : kind.many(items.length),
      detail: [...new Set(items.map((item) => item.title))].slice(0, 3).join(' · '),
      batch: newest.kind === 'batch_ended' ? undefined : newest.batch?.name,
      batchId: newest.batch_id ?? undefined,
      count: items.length,
      rows: [],
      to: newest.link,
      ids: items.map((item) => item.id),
      read: Boolean(newest.read_at),
      at: newest.created_at,
    };
  });
}

// What the signed-in person has waiting as live counts, refreshed every minute and when something changes
export function useNotices(): Notice[] {
  const { user, isAdmin, isTutor, isStudent } = useAuth();
  const studentId = user?.student_id;
  const owner = user?.id;
  // Tagged with whose they are, so a sign-out and sign-in never shows the last person's
  const [state, setState] = useState<{ owner?: string; list: Notice[] }>({ list: [] });

  useEffect(() => {
    const load = isAdmin ? adminNotices : isTutor ? tutorNotices : isStudent && studentId ? () => studentNotices(studentId) : null;
    if (!load) return;
    let live = true;
    const run = () => load().then((next) => { if (live) setState({ owner, list: next }); }).catch(console.error);
    run();
    const timer = setInterval(run, POLL_MS);
    window.addEventListener(CLAIMS_CHANGED, run);
    window.addEventListener(NOTICES_CHANGED, run);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener(CLAIMS_CHANGED, run);
      window.removeEventListener(NOTICES_CHANGED, run);
    };
  }, [isAdmin, isTutor, isStudent, studentId, owner]);

  return state.owner === owner ? state.list : [];
}
