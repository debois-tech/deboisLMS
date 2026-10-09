import { supabase } from '../client';
import { ok, rows } from './result';
import type { NotificationRow } from '@/lib/types';

// RLS hands back only the signed-in person's own rows
export async function getMyNotifications(): Promise<NotificationRow[]> {
  return rows<NotificationRow>(
    await supabase.from('notifications').select('*, batch:batches(name)').order('created_at', { ascending: false }).limit(200),
    'Could not load notifications',
  );
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  ok(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null), 'Could not mark as read');
}

export async function markAllNotificationsRead(): Promise<void> {
  ok(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null), 'Could not mark as read');
}

// Calls back on any change to the person's rows; returns the way to stop listening
export function subscribeToNotifications(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
