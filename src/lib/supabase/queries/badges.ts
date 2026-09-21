import { supabase } from '../client';
import { ok, row, rows } from './result';
import type { BatchBadge, Student, StudentBadge } from '@/lib/types';
import { extensionOf } from '@/lib/utils/files';

/** Matches the tutor's storage policy and the assets bucket's 5 MB cap. */
export const BADGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;
export const BADGE_MAX_BYTES = 5 * 1024 * 1024;
export const BADGE_ACCEPT = BADGE_EXTENSIONS.map((ext) => `.${ext}`).join(',');

/** Public URL, no fetch: the assets bucket is served straight off a CDN. */
export function badgeImageUrl(path: string): string {
  return supabase.storage.from('assets').getPublicUrl(path).data.publicUrl;
}

export type BadgeWithHolders = BatchBadge & { holders: number };

export async function getBatchBadges(batchId: string): Promise<BadgeWithHolders[]> {
  const found = rows<BatchBadge & { student_badges: { count: number }[] }>(
    await supabase
      .from('batch_badges')
      .select('*, student_badges(count)')
      .eq('batch_id', batchId)
      .order('created_at'),
    'Could not load badges',
  );
  return found.map(({ student_badges, ...badge }) => ({ ...badge, holders: student_badges[0]?.count ?? 0 }));
}

export interface NewBadgeInput {
  batchId: string;
  name: string;
  description: string;
  file: File;
}

export async function createBatchBadge({ batchId, name, description, file }: NewBadgeInput): Promise<BatchBadge> {
  const path = `badges/${batchId}/${crypto.randomUUID()}.${extensionOf(file.name)}`;
  const upload = await supabase.storage.from('assets').upload(path, file, { contentType: file.type });
  if (upload.error) throw new Error(`Could not upload the badge image: ${upload.error.message}`);

  const created = await supabase
    .from('batch_badges')
    .insert({ batch_id: batchId, name, description: description || null, image_path: path })
    .select('*')
    .single();
  if (created.error) {
    // No row points at the file, so it would sit in the bucket forever.
    await supabase.storage.from('assets').remove([path]);
  }
  return row<BatchBadge>(created, 'Could not save the badge');
}

/** The students holding it lose it with the row, through the cascade. */
export async function deleteBatchBadge(badge: BatchBadge): Promise<void> {
  ok(await supabase.from('batch_badges').delete().eq('id', badge.id), 'Could not delete the badge');
  await supabase.storage.from('assets').remove([badge.image_path]);
}

export type BadgeHolder = StudentBadge & { student: Pick<Student, 'id' | 'name' | 'student_code'> };

export async function getBadgeHolders(badgeId: string): Promise<BadgeHolder[]> {
  return rows<BadgeHolder>(
    await supabase
      .from('student_badges')
      .select('*, student:students(id, name, student_code)')
      .eq('badge_id', badgeId)
      .order('issued_at', { ascending: false }),
    'Could not load who holds this badge',
  );
}

/** Students who already have it are skipped, so giving twice is harmless. */
export async function giveBadge(badgeId: string, studentIds: string[]): Promise<void> {
  ok(
    await supabase
      .from('student_badges')
      .upsert(studentIds.map((student_id) => ({ badge_id: badgeId, student_id })), {
        onConflict: 'student_id,badge_id',
        ignoreDuplicates: true,
      }),
    'Could not give the badge',
  );
}

export async function takeBadge(studentBadgeId: string): Promise<void> {
  ok(await supabase.from('student_badges').delete().eq('id', studentBadgeId), 'Could not take the badge back');
}

export interface MyBadges {
  /** Every badge of the batches the student is in. */
  badges: BatchBadge[];
  /** Which of them they hold, keyed by badge id. */
  earned: Map<string, StudentBadge>;
}

/** The student's own view: RLS already limits both lists to them. */
export async function getMyBadges(): Promise<MyBadges> {
  const [badges, earned] = await Promise.all([
    supabase.from('batch_badges').select('*').order('created_at'),
    supabase.from('student_badges').select('id, student_id, badge_id, issued_at'),
  ]);
  return {
    badges: rows<BatchBadge>(badges, 'Could not load your badges'),
    earned: new Map(rows<StudentBadge>(earned, 'Could not load your badges').map((badge) => [badge.badge_id, badge])),
  };
}
