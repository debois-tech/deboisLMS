import { supabase } from '../client';
import { ok, row, rows } from './result';
import type { Feedback, FeedbackKind, FeedbackStatus } from '@/lib/types';

/** The caller's own reports; the developer gets everyone's. RLS decides which. */
export async function getFeedback(): Promise<Feedback[]> {
  return rows<Feedback>(
    await supabase.from('feedback').select('*').order('created_at', { ascending: false }),
    'Could not load the reports',
  );
}

// Who is reporting is stamped by the database from the login.
export async function submitFeedback(input: { kind: FeedbackKind; message: string; page: string }): Promise<Feedback> {
  return row<Feedback>(
    await supabase
      .from('feedback')
      .insert({ kind: input.kind, message: input.message.trim(), page: input.page.trim(), user_agent: navigator.userAgent })
      .select()
      .single(),
    'Could not send your report',
  );
}

export async function setFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  ok(
    await supabase.from('feedback').update({ status }).eq('id', id),
    'Could not update this report',
  );
}
