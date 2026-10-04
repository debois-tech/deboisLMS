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
  if (error) throw new Error(error.message);
  return data.maintenance_mode;
}
