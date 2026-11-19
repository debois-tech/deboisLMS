import { techError } from '@/lib/utils/errors';
import { supabase } from '../client';
import { row } from './result';

/** The year in student refs and badge IDs for whoever is enrolled next, e.g. 2026 in DBT-INT-2026-001. */
export async function getStudentCodeYear(): Promise<number> {
  return Number(row<string>(await supabase.rpc('student_code_year'), 'Could not load the student ref year'));
}

/** Moves refs to the next year and restarts the count at 001. Returns the new year. */
export async function rollStudentCodeYear(): Promise<number> {
  const prefix = row<string>(await supabase.rpc('roll_student_code_year'), 'Could not roll the year');
  return Number(prefix.match(/\d{4}/)?.[0]);
}

// Single row, seeded once by schema.sql — read/write it without needing its id.
export async function getMaintenanceMode(): Promise<boolean> {
  const { data } = await supabase.from('app_settings').select('maintenance_mode').limit(1).maybeSingle();
  return data?.maintenance_mode ?? false;
}

export async function setMaintenanceMode(enabled: boolean): Promise<boolean> {
  const { data, error } = await supabase
    .from('app_settings')
    .update({ maintenance_mode: enabled, updated_at: new Date().toISOString() })
    // PostgREST refuses an UPDATE with no filter at all — id is never null, so
    // this matches the single row unconditionally without a fetch-first round trip.
    .not('id', 'is', null)
    .select('maintenance_mode')
    .single();
  if (error) throw techError('Could not update the setting', error.message);
  return data.maintenance_mode;
}

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
}

// Developer only: the edge function refuses anyone else.
async function manageAdmins<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('manage-admins', { body });
  if (error) {
    const response = (error as { context?: Response }).context;
    const detail = response && typeof response.json === 'function'
      ? await response.json().then((reply: { error?: string } | null) => reply?.error).catch(() => undefined)
      : undefined;
    throw new Error(detail ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function listAdminAccounts(): Promise<AdminAccount[]> {
  return (await manageAdmins<{ admins: AdminAccount[] }>({ action: 'list' })).admins;
}

export async function createAdminAccount(input: { full_name: string; email: string; password: string }): Promise<void> {
  await manageAdmins({ action: 'create', ...input });
}
