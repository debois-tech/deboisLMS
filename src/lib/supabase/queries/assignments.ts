import { techError } from '@/lib/utils/errors';
import { supabase } from '../client';
import { deleteMaterial, getMaterialsByAssignment } from './materials';
import type { Assignment, AssignmentCompletion, SubmissionChannel } from '@/lib/types';

/** One row per active student in the batch — exactly the admin submission table (and its CSV). */
export interface AssignmentSubmissionRow {
  student_id: string;
  student_name: string;
  submitted: boolean;
  mark: boolean;
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

/** Every assignment from a student's batches, paired with their own completion row. */
export async function getAssignmentsForStudent(
  studentId: string,
): Promise<(Assignment & { completion?: AssignmentCompletion })[]> {
  const { data: mappings } = await supabase
    .from('batch_student_mapping')
    .select('batch_id')
    .eq('student_id', studentId);

  const batchIds = ((mappings ?? []) as { batch_id: string }[]).map((m) => m.batch_id);
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

// Lets an admin push out a due date on an existing assignment, past ones included.
export async function updateAssignment(
  id: string,
  patch: Pick<Assignment, 'title' | 'description' | 'due_at'>,
): Promise<Assignment> {
  const { data, error } = await supabase.from('assignments').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as Assignment;
}

// Files first: an assignment's handouts would otherwise cascade-delete as orphaned storage objects.
export async function deleteAssignment(id: string): Promise<void> {
  const materials = await getMaterialsByAssignment(id);
  await Promise.all(materials.map((material) => deleteMaterial(material)));

  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw techError('Could not delete the assignment', error.message);
}

// Every active student and their submission. The CSV export ships these same rows.
export async function getAssignmentSubmissions(
  assignmentId: string,
  batchId: string,
): Promise<AssignmentSubmissionRow[]> {
  const { data: mappings } = await supabase
    .from('batch_student_mapping')
    .select('student_id, students(id, name)')
    .eq('batch_id', batchId)
    .eq('status', 'active');

  type RosterRow = { student_id: string; students: { id: string; name: string } | null };

  const roster = ((mappings ?? []) as unknown as RosterRow[])
    .map((m) => ({ id: m.student_id, name: m.students?.name ?? 'Unknown' }));
  if (roster.length === 0) return [];

  const { data: completions } = await supabase
    .from('assignment_completions')
    .select('*')
    .eq('assignment_id', assignmentId);

  const completionByStudent = new Map(
    ((completions ?? []) as AssignmentCompletion[]).map((c) => [c.student_id, c]),
  );

  return roster
    .map((student) => {
      const completion = completionByStudent.get(student.id);
      return {
        student_id: student.id,
        student_name: student.name,
        submitted: completion?.submitted ?? false,
        mark: completion?.mark ?? false,
        // This assignment's own link, never the shared latest one.
        repo_url: completion?.repo_url ?? undefined,
        submitted_at: completion?.submitted_at,
      };
    })
    .sort((a, b) => a.student_name.localeCompare(b.student_name));
}

/** The link the student handed in last time, to prefill the next submit form. */
export async function getLatestSubmissionRepo(studentId: string): Promise<string | undefined> {
  const { data } = await supabase
    .from('assignment_completions')
    .select('repo_url')
    .eq('student_id', studentId)
    .not('repo_url', 'is', null)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .limit(1);
  return (data?.[0]?.repo_url as string | undefined) ?? undefined;
}

/** submitted_at and submitted_via are not sent — the guard trigger sets them. */
export async function submitAssignmentFromPortal(
  assignmentId: string,
  studentId: string,
  repoUrl: string,
): Promise<AssignmentCompletion> {
  const existing = await supabase
    .from('assignment_completions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle();

  const patch = {
    submitted: true,
    submitted_via: 'portal' as SubmissionChannel,
    submitted_at: new Date().toISOString(),
    repo_url: repoUrl,
  };

  if (existing.data) {
    const { data, error } = await supabase
      .from('assignment_completions')
      .update(patch)
      .eq('id', existing.data.id)
      .select()
      .single();
    if (error) throw error;
    return data as AssignmentCompletion;
  }

  const { data, error } = await supabase
    .from('assignment_completions')
    .insert({ assignment_id: assignmentId, student_id: studentId, ...patch })
    .select()
    .single();
  if (error) throw error;
  return data as AssignmentCompletion;
}

/** Admin's manual mark, independent of the student-driven submitted flag. */
export async function setAssignmentMark(
  assignmentId: string,
  studentId: string,
  mark: boolean,
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
      .update({ mark })
      .eq('id', existing.data.id)
      .select()
      .single();
    if (error) throw error;
    return data as AssignmentCompletion;
  }

  const { data, error } = await supabase
    .from('assignment_completions')
    .insert({ assignment_id: assignmentId, student_id: studentId, mark })
    .select()
    .single();
  if (error) throw error;
  return data as AssignmentCompletion;
}
