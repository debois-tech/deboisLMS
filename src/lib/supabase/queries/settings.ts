import { supabase } from '../client';

// Single row, seeded once by schema.sql — read/write it without needing its id.
export async function getMaintenanceMode(): Promise<boolean> {
  const { data } = await supabase.from('app_settings').select('maintenance_mode').limit(1).maybeSingle();
  return data?.maintenance_mode ?? false;
}

export async function setMaintenanceMode(enabled: boolean): Promise<boolean> {
  const { data, error } = await supabase
    .from('app_settings')
    .update({ maintenance_mode: enabled, updated_at: new Date().toISOString() })
    .select('maintenance_mode')
    .single();
  if (error) throw new Error(error.message);
  return data.maintenance_mode;
}
