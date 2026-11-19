import { supabase } from '../client';
import { ok, rows } from './result';

export type LogKind = 'tutor' | 'admin';

/** One entry of either log, so the page treats them alike. `role` is set on admin entries only. */
export interface LogAction {
  id: string;
  actor: string;
  role?: 'admin' | 'developer';
  op: 'created' | 'updated' | 'deleted';
  item: string;
  detail: string | null;
  batch_id: string | null;
  times: number;
  created_at: string;
}

type Row = Omit<LogAction, 'actor' | 'role'> & { tutor_name?: string; admin_name?: string; actor_role?: LogAction['role'] };

const TABLE: Record<LogKind, string> = { tutor: 'tutor_actions', admin: 'admin_actions' };

// Newest first; written by database triggers on everything a tutor or admin changes
export async function getLogActions(kind: LogKind): Promise<LogAction[]> {
  const data = rows<Row>(
    await supabase.from(TABLE[kind]).select('*').order('created_at', { ascending: false }).limit(500),
    `Could not load the ${kind} log`,
  );
  return data.map(({ tutor_name, admin_name, actor_role, ...rest }) => ({ ...rest, actor: tutor_name ?? admin_name ?? '', role: actor_role }));
}

// The nightly job (expire_students) clears 90 days; this is the developer's on-demand version. Returns how many went.
export async function deleteOldLogs(kind: LogKind, days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { error, count } = await supabase.from(TABLE[kind]).delete({ count: 'exact' }).lt('created_at', cutoff);
  ok({ error }, 'Could not clear old logs');
  return count ?? 0;
}
