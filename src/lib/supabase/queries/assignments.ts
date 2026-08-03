import { supabase } from '../client';
import type { Assignment, AssignmentCompletion, StudentRepo, SubmissionChannel } from '@/lib/types';

/** One row per active student in the batch — exactly the admin submission table (and its CSV). */
export interface AssignmentSubmissionRow {
  student_id: string;
  student_name: string;
  submitted: boolean;
  repo_url?: string;
  submitted_at?: string;
}

export async function getAssignmentsByBatch(batchId: string): Promise<Assignment[]> {
  const { data } = await supabase
    .from('assignments')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Assignment[];
}

/**
 * Every assignment from the batches a student belongs to, paired with that student's
 * own completion row (undefined when they have no row yet — i.e. not submitted).
 */
export async function getAssignmentsForStudent(
  studentId: string,
): Promise<(Assignment & { completion?: AssignmentCompletion })[]> {
  const { data: mappings } = await supabase
    .from('batch_student_mapping')
    .select('batch_id')
    .eq('student_id', studentId);

  const batchIds = (mappings ?? []).map((m: any) => m.batch_id as string);
  if (batchIds.length === 0) return [];

  const [{ data: assignments }, { data: completions }] = await Promise.all([
    supabase.from('assignments').select('*').in('batch_id', batchIds).order('assigned_date', { ascending: false }),
    supabase.from('assignment_completions').select('*').eq('student_id', studentId),
  ]);

  const completionByAssignment = new Map(
    ((completions ?? []) as AssignmentCompletion[]).map((c) => [c.assignment_id, c]),
  );

  return ((assignments ?? []) as Assignment[]).map((a) => ({
    ...a,
    completion: completionByAssignment.get(a.id),
  }));
}

export async function createAssignment(input: Omit<Assignment, 'id' | 'created_at'>): Promise<Assignment> {
  const { data } = await supabase
    .from('assignments')
    .insert(input)
    .select()
    .single();
  return data as Assignment;
}

/**
 * The admin submission table for one assignment: every actively enrolled student in
 * the batch, whether they have a completion row or not, joined to the single repo
 * link they submit all their homework from. The CSV export ships the same rows, so
 * the file and the screen can never disagree.
 */
export async function getAssignmentSubmissions(
  assignmentId: string,
  batchId: string,
): Promise<AssignmentSubmissionRow[]> {
  const { data: mappings } = await supabase
    .from('batch_student_mapping')
    .select('student_id, students(id, name)')
    .eq('batch_id', batchId)
    .eq('status', 'active');

  const roster = ((mappings ?? []) as any[])
    .map((m) => ({ id: m.student_id as string, name: (m.students?.name as string) ?? 'Unknown' }));
  if (roster.length === 0) return [];

  const studentIds = roster.map((s) => s.id);
  const [{ data: completions }, { data: repos }] = await Promise.all([
    supabase.from('assignment_completions').select('*').eq('assignment_id', assignmentId),
    supabase.from('student_repos').select('*').in('student_id', studentIds),
  ]);

  const completionByStudent = new Map(
    ((completions ?? []) as AssignmentCompletion[]).map((c) => [c.student_id, c]),
  );
  const repoByStudent = new Map(
    ((repos ?? []) as StudentRepo[]).map((r) => [r.student_id, r.repo_url]),
  );

  return roster
    .map((student) => {
      const completion = completionByStudent.get(student.id);
      return {
        student_id: student.id,
        student_name: student.name,
        submitted: completion?.submitted ?? false,
        repo_url: repoByStudent.get(student.id),
        submitted_at: completion?.submitted_at,
      };
    })
    .sort((a, b) => a.student_name.localeCompare(b.student_name));
}

export async function getStudentRepo(studentId: string): Promise<StudentRepo | undefined> {
  const { data } = await supabase
    .from('student_repos')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
  return (data ?? undefined) as StudentRepo | undefined;
}

export async function saveStudentRepo(studentId: string, repoUrl: string): Promise<StudentRepo> {
  const { data, error } = await supabase
    .from('student_repos')
    .upsert({ student_id: studentId, repo_url: repoUrl }, { onConflict: 'student_id' })
    .select()
    .single();
  if (error) throw error;
  return data as StudentRepo;
}

/**
 * A student submitting from the portal. The repo link is saved first so the admin
 * table never shows a submission with a stale (or missing) link next to it.
 */
export async function submitAssignmentFromPortal(
  assignmentId: string,
  studentId: string,
  repoUrl: string,
): Promise<AssignmentCompletion> {
  await saveStudentRepo(studentId, repoUrl);
  return markSubmission(assignmentId, studentId, true, 'portal');
}

export async function markSubmission(
  assignmentId: string,
  studentId: string,
  submitted: boolean,
  submittedVia: SubmissionChannel = 'whatsapp',
): Promise<AssignmentCompletion> {
  const existing = await supabase
    .from('assignment_completions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (existing.data) {
    const { data, error } = await supabase
      .from('assignment_completions')
      .update({
        submitted,
        submitted_via: submittedVia,
        submitted_at: submitted ? new Date().toISOString() : null,
      })
      .eq('id', existing.data.id)
      .select()
      .single();
    if (error) throw error;
    return data as AssignmentCompletion;
  }

  const { data, error } = await supabase
    .from('assignment_completions')
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      submitted,
      submitted_via: submittedVia,
      submitted_at: submitted ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as AssignmentCompletion;
}