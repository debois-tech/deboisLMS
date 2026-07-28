import { supabase } from '../client';
import type { UploadRow, AttendanceRecord } from '@/lib/types';

export async function getUploadsByLecture(lectureId: string): Promise<UploadRow[]> {
  const { data } = await supabase
    .from('uploads')
    .select('*')
    .eq('lecture_id', lectureId)
    .order('sno');
  return (data ?? []) as UploadRow[];
}

export async function getAttendanceByLecture(lectureId: string): Promise<AttendanceRecord[]> {
  const { data } = await supabase
    .from('attendance')
    .select('*')
    .eq('lecture_id', lectureId);
  return (data ?? []) as AttendanceRecord[];
}

export async function insertUploadRows(
  lectureId: string,
  meetingCode: string,
  rows: { sno: number; participant_name_raw: string; joined_at?: string; attendance_stopped?: string; attended_duration_raw?: string; attended_minutes?: number }[]
): Promise<void> {
  const records = rows.map((r) => ({
    lecture_id: lectureId,
    sno: r.sno,
    participant_name_raw: r.participant_name_raw,
    joined_at: r.joined_at ?? null,
    attendance_stopped: r.attendance_stopped ?? null,
    attended_duration_raw: r.attended_duration_raw ?? null,
    attended_minutes: r.attended_minutes ?? null,
    meeting_code: meetingCode,
    processed: false,
  }));

  await supabase.from('uploads').insert(records);
}

export async function processAttendance(lectureId: string, batchId: string): Promise<AttendanceRecord[]> {
  const [uploadsRes, lectureRes, studentsRes] = await Promise.all([
    supabase.from('uploads').select('*').eq('lecture_id', lectureId).eq('processed', false),
    supabase.from('lectures').select('scheduled_duration_minutes').eq('id', lectureId).single(),
    supabase.from('batch_student_mapping').select('student_id, students!inner(name)').eq('batch_id', batchId).eq('status', 'active'),
  ]);

  const rawRows = (uploadsRes.data ?? []) as any[];
  const lecture = lectureRes.data as { scheduled_duration_minutes: number } | null;
  const roster = (studentsRes.data ?? []) as any[];

  const scheduledMinutes = lecture?.scheduled_duration_minutes ?? 90;

  const rosterMap = new Map<string, string>();
  for (const r of roster) {
    rosterMap.set((r.students?.name ?? '').toLowerCase().trim(), r.student_id);
  }

  const matched = new Map<string, { total_minutes: number; raw_ids: string[]; names: string[] }>();

  for (const row of rawRows) {
    const name = (row.participant_name_raw ?? '').toLowerCase().trim();
    const studentId = rosterMap.get(name);
    if (!studentId) continue;

    if (!matched.has(studentId)) {
      matched.set(studentId, { total_minutes: 0, raw_ids: [], names: [] });
    }
    const entry = matched.get(studentId)!;
    entry.total_minutes += Number(row.attended_minutes ?? 0);
    entry.raw_ids.push(row.id);
    entry.names.push(row.participant_name_raw);
  }

  const attendanceInserts: any[] = [];

  for (const [studentId, data] of matched) {
    const pct = scheduledMinutes > 0 ? (data.total_minutes / scheduledMinutes) * 100 : 0;
    let status: string;
    if (pct >= 90) status = 'present';
    else if (pct >= 65) status = 'partial';
    else status = 'absent';

    attendanceInserts.push({
      student_id: studentId,
      batch_id: batchId,
      lecture_id: lectureId,
      status,
      total_attended_minutes: data.total_minutes,
      raw_upload_ids: data.raw_ids,
      source: 'automated',
      approved: false,
    });
  }

  if (attendanceInserts.length > 0) {
    await supabase.from('attendance').insert(attendanceInserts);
  }

  await supabase.from('uploads').delete().eq('lecture_id', lectureId);

  const { data } = await supabase
    .from('attendance')
    .select('*')
    .eq('lecture_id', lectureId);
  return (data ?? []) as AttendanceRecord[];
}

export async function approveAttendance(id: string): Promise<AttendanceRecord | undefined> {
  const { data } = await supabase
    .from('attendance')
    .update({ approved: true, approved_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return data as AttendanceRecord | undefined;
}

export async function bulkApproveAttendance(lectureId: string): Promise<number> {
  const { data } = await supabase
    .from('attendance')
    .update({ approved: true, approved_at: new Date().toISOString() })
    .eq('lecture_id', lectureId)
    .eq('approved', false)
    .select();
  return (data ?? []).length;
}

export async function getUnapprovedCount(): Promise<number> {
  const { count } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('approved', false);
  return count ?? 0;
}