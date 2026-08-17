import { supabase } from '../client';
import { ok, row, rows } from './result';
import type { Feedback, FeedbackKind, FeedbackStatus } from '@/lib/types';

/** The student's own reports. RLS scopes this to them. */
export async function getMyFeedback(): Promise<Feedback[]> {
  return rows<Feedback>(
    await supabase.from('feedback').select('*').order('created_at', { ascending: false }),
    'Could not load your reports',
  );
}

export async function submitFeedback(input: {
  studentId: string;
  kind: FeedbackKind;
  message: string;
}): Promise<Feedback> {
  return row<Feedback>(
    await supabase
      .from('feedback')
      .insert({
        student_id: input.studentId,
        kind: input.kind,
        message: input.message.trim(),
        // Captured here, not asked for — the two facts that make a report usable.
        page: window.location.pathname,
        user_agent: navigator.userAgent,
      })
      .select()
      .single(),
    'Could not send your report',
  );
}

/** Admin-side: every report with its student joined in. */
export async function getAllFeedback(): Promise<Feedback[]> {
  return rows<Feedback>(
    await supabase
      .from('feedback')
      .select('*, student:students(id, name, student_code, email)')
      .order('created_at', { ascending: false }),
    'Could not load feedback',
  );
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  ok(
    await supabase.from('feedback').update({ status }).eq('id', id),
    'Could not update this report',
  );
}
