import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../client';
import { rows } from './result';
import { getBatchFeeSummary } from './fees';

/** Count queries answer with `count`, not `data`, so they need their own check. */
function count(result: { count: number | null; error: { message: string } | null }, what: string): number {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.count ?? 0;
}

export interface DashboardStats {
  total_batches: number;
  active_batches: number;
  total_students: number;
  pending_attendance: number;
  total_fees_collected: number;
  total_fees_outstanding: number;
}

export interface RecentActivity {
  id: string;
  text: string;
  timestamp: string;
  type: 'batch_created' | 'student_joined' | 'attendance_approved' | 'payment_made';
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [batchRes, activeRes, studentRes, attendanceRes, feeSummary] = await Promise.all([
    supabase.from('batches').select('*', { count: 'exact', head: true }),
    supabase.from('batches').select('*', { count: 'exact', head: true }).eq('status', 'ongoing'),
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('approved', false),
    getBatchFeeSummary(),
  ]);

  return {
    total_batches: count(batchRes, 'Could not count batches'),
    active_batches: count(activeRes, 'Could not count active batches'),
    total_students: count(studentRes, 'Could not count students'),
    pending_attendance: count(attendanceRes, 'Could not count pending attendance'),
    total_fees_collected: feeSummary.reduce((s, f) => s + f.total_collected, 0),
    total_fees_outstanding: feeSummary.reduce((s, f) => s + f.total_outstanding, 0),
  };
}

export async function getRecentActivity(): Promise<RecentActivity[]> {
  const results: RecentActivity[] = [];

  const batches = rows<{ id: string; name: string; created_at: string }>(
    await supabase
      .from('batches')
      .select('id, name, created_at')
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
      .select('id, joined_at, students(name), batches(name)')
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
