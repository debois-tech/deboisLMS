import { techError } from '@/lib/utils/errors';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../client';
import { rows } from './result';
import { getBatchFeeSummary } from './fees';

/** Count queries answer with `count`, not `data`, so they need their own check. */
function count(result: { count: number | null; error: { message: string } | null }, what: string): number {
  if (result.error) throw techError(what, result.error.message);
  return result.count ?? 0;
}

export interface DashboardStats {
  total_batches: number;
  active_batches: number;
  total_students: number;
  total_fees_collected: number;
  total_fees_outstanding: number;
}

export interface RecentActivity {
  id: string;
  text: string;
  timestamp: string;
  type: 'batch_created' | 'student_joined' | 'payment_made' | 'submission' | 'lecture_added';
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [batchRes, activeRes, studentRes, feeSummary] = await Promise.all([
    supabase.from('batches').select('*', { count: 'exact', head: true }).eq('is_test', false),
    supabase.from('batches').select('*', { count: 'exact', head: true }).eq('status', 'ongoing').eq('is_test', false),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_test', false),
    getBatchFeeSummary(),
  ]);

  const live = feeSummary.filter((f) => !f.is_test);

  return {
    total_batches: count(batchRes, 'Could not count batches'),
    active_batches: count(activeRes, 'Could not count active batches'),
    total_students: count(studentRes, 'Could not count students'),
    total_fees_collected: live.reduce((s, f) => s + f.total_collected, 0),
    total_fees_outstanding: live.reduce((s, f) => s + f.total_outstanding, 0),
  };
}

export interface TutorDashboardStats {
  batch_count: number;
  student_count: number;
  pending_grading: number;
}

/** RLS already scopes every one of these to the signed-in tutor's own batches. */
export async function getTutorDashboardStats(): Promise<TutorDashboardStats> {
  const [batchRes, rosterRes, gradingRes] = await Promise.all([
    supabase.from('batches').select('*', { count: 'exact', head: true }),
    supabase.from('batch_student_mapping').select('student_id').eq('status', 'active'),
    supabase.from('assignment_completions').select('*', { count: 'exact', head: true }).eq('submitted', true).eq('mark', false),
  ]);

  return {
    batch_count: count(batchRes, 'Could not count batches'),
    student_count: new Set(rows<{ student_id: string }>(rosterRes, 'Could not count students').map((r) => r.student_id)).size,
    pending_grading: count(gradingRes, 'Could not count pending grading'),
  };
}

type Embedded<T> = { data: T[] | null; error: PostgrestError | null };

/** The tutor's latest submissions, joins and lectures; RLS keeps all three to their own batches. */
export async function getTutorRecentActivity(): Promise<RecentActivity[]> {
  type Submission = { id: string; submitted_at: string; students: { name: string } | null; assignments: { title: string; batches: { name: string } | null } | null };
  type Joined = { id: string; joined_at: string; students: { name: string } | null; batches: { name: string } };
  type Lecture = { id: string; created_at: string; batches: { name: string } };

  const [submissions, joins, lectures] = await Promise.all([
    supabase
      .from('assignment_completions')
      .select('id, submitted_at, students(name), assignments(title, batches(name))')
      .eq('submitted', true)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false })
      .limit(5),
    supabase.from('batch_student_mapping').select('id, joined_at, students(name), batches!inner(name)').order('joined_at', { ascending: false }).limit(5),
    supabase.from('lectures').select('id, created_at, batches!inner(name)').order('created_at', { ascending: false }).limit(5),
  ]);

  const results: RecentActivity[] = [
    ...rows<Submission>(submissions as unknown as Embedded<Submission>, 'Could not load recent submissions').map((s) => ({
      id: `act-sub-${s.id}`,
      text: `${s.students?.name ?? 'A student'} submitted ${s.assignments?.title ?? 'an assignment'}${s.assignments?.batches ? ` in ${s.assignments.batches.name}` : ''}`,
      timestamp: s.submitted_at,
      type: 'submission' as const,
    })),
    ...rows<Joined>(joins as unknown as Embedded<Joined>, 'Could not load recent enrolments').map((m) => ({
      id: `act-join-${m.id}`,
      text: `${m.students?.name ?? 'A student'} joined ${m.batches.name}`,
      timestamp: m.joined_at,
      type: 'student_joined' as const,
    })),
    ...rows<Lecture>(lectures as unknown as Embedded<Lecture>, 'Could not load recent lectures').map((l) => ({
      id: `act-lec-${l.id}`,
      text: `Lecture added in ${l.batches.name}`,
      timestamp: l.created_at,
      type: 'lecture_added' as const,
    })),
  ];

  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
}

export async function getRecentActivity(): Promise<RecentActivity[]> {
  const results: RecentActivity[] = [];

  const batches = rows<{ id: string; name: string; created_at: string }>(
    await supabase
      .from('batches')
      .select('id, name, created_at')
      .eq('is_test', false)
      .order('created_at', { ascending: false })
      .limit(3),
    'Could not load recent batches',
  );

  batches.forEach((b) =>
    results.push({
      id: `act-b-${b.id}`,
      text: `Batch "${b.name}" created`,
      timestamp: b.created_at,
      type: 'batch_created',
    })
  );

  type EnrolmentRow = {
    id: string;
    joined_at: string;
    students: { name: string } | null;
    batches: { name: string } | null;
  };

  const mappings = rows<EnrolmentRow>(
    (await supabase
      .from('batch_student_mapping')
      .select('id, joined_at, students(name), batches!inner(name, is_test)')
      .eq('batches.is_test', false)
      .order('joined_at', { ascending: false })
      .limit(3)) as unknown as { data: EnrolmentRow[] | null; error: PostgrestError | null },
    'Could not load recent enrolments',
  );

  mappings.forEach((m) =>
    results.push({
      id: `act-s-${m.id}`,
      text: `${m.students?.name ?? 'A student'} joined ${m.batches?.name ?? 'a batch'}`,
      timestamp: m.joined_at,
      type: 'student_joined',
    })
  );

  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
}
