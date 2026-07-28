import { supabase } from '../client';
import { getBatchFeeSummary } from './fees';

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
  const [batchRes, studentRes, attendanceRes, feeSummary] = await Promise.all([
    supabase.from('batches').select('*', { count: 'exact', head: true }),
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('approved', false),
    getBatchFeeSummary(),
  ]);

  const totalBatches = batchRes.count ?? 0;
  const { count: activeBatches } = await supabase
    .from('batches')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ongoing');

  return {
    total_batches: totalBatches,
    active_batches: activeBatches ?? 0,
    total_students: studentRes.count ?? 0,
    pending_attendance: attendanceRes.count ?? 0,
    total_fees_collected: feeSummary.reduce((s, f) => s + f.total_collected, 0),
    total_fees_outstanding: feeSummary.reduce((s, f) => s + f.total_outstanding, 0),
  };
}

export async function getRecentActivity(): Promise<RecentActivity[]> {
  const results: RecentActivity[] = [];

  const { data: batches } = await supabase
    .from('batches')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  batches?.forEach((b) =>
    results.push({
      id: `act-b-${b.id}`,
      text: `Batch "${b.name}" created`,
      timestamp: b.created_at,
      type: 'batch_created',
    })
  );

  const { data: mappings } = await supabase
    .from('batch_student_mapping')
    .select('id, joined_at, students(name), batches(name)')
    .order('joined_at', { ascending: false })
    .limit(3);

  mappings?.forEach((m: any) =>
    results.push({
      id: `act-s-${m.id}`,
      text: `${m.students?.name ?? 'A student'} joined ${m.batches?.name ?? 'a batch'}`,
      timestamp: m.joined_at,
      type: 'student_joined',
    })
  );

  return results.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
}