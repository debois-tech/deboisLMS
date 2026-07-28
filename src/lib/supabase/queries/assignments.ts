import { supabase } from '../client';
import type { Assignment, AssignmentCompletion } from '@/lib/types';

export async function getAssignmentsByBatch(batchId: string): Promise<Assignment[]> {
  const { data } = await supabase
    .from('assignments')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false });
  return (data ?? []) as Assignment[];
}

export async function createAssignment(input: Omit<Assignment, 'id' | 'created_at'>): Promise<Assignment> {
  const { data } = await supabase
    .from('assignments')
    .insert(input)
    .select()
    .single();
  return data as Assignment;
}

export async function getCompletionsByAssignment(assignmentId: string): Promise<(AssignmentCompletion & { student_name: string })[]> {
  const { data } = await supabase
    .from('assignment_completions')
    .select('*, students(name)')
    .eq('assignment_id', assignmentId);

  if (!data) return [];
  return data.map((c: any) => ({
    id: c.id,
    assignment_id: c.assignment_id,
    student_id: c.student_id,
    submitted: c.submitted,
    submitted_via: c.submitted_via,
    submitted_at: c.submitted_at,
    marked_by: c.marked_by,
    student_name: c.students?.name ?? 'Unknown',
  }));
}

export async function markSubmission(
  assignmentId: string,
  studentId: string,
  submitted: boolean,
  submittedVia: 'whatsapp' | 'other' = 'whatsapp',
): Promise<AssignmentCompletion> {
  const existing = await supabase
    .from('assignment_completions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (existing.data) {
    const { data } = await supabase
      .from('assignment_completions')
      .update({
        submitted,
        submitted_via: submittedVia,
        submitted_at: submitted ? new Date().toISOString() : null,
      })
      .eq('id', existing.data.id)
      .select()
      .single();
    return data as AssignmentCompletion;
  }

  const { data } = await supabase
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
  return data as AssignmentCompletion;
}