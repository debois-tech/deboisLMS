import { supabase } from '../client';
import type { Student, BatchStudentMapping, StudentCredentials } from '@/lib/types';

export async function getStudents(): Promise<Student[]> {
  const { data } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false });
  return (data ?? []) as Student[];
}

export async function getStudentById(id: string): Promise<Student | undefined> {
  const { data } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single();
  return data as Student | undefined;
}

export async function createStudent(input: Omit<Student, 'id' | 'created_at'>): Promise<Student> {
  const { data } = await supabase
    .from('students')
    .insert(input)
    .select()
    .single();
  return data as Student;
}

const normalizePhone = (phone: string | undefined | null) => (phone ?? '').replace(/\D/g, '');

export async function findExistingStudent(input: { name?: string; phone?: string; email?: string }): Promise<Student | undefined> {
  const { data } = await supabase.from('students').select('*');
  const students = (data ?? []) as Student[];
  const phone = normalizePhone(input.phone);
  const email = input.email?.trim().toLowerCase();
  const name = input.name?.trim().toLowerCase();
  return students.find((s) => {
    if (phone && s.phone && normalizePhone(s.phone) === phone) return true;
    if (email && s.email && s.email.trim().toLowerCase() === email) return true;
    if (name && s.name && s.name.trim().toLowerCase() === name) return true;
    return false;
  });
}

export async function createOrReuseStudent(input: Omit<Student, 'id' | 'created_at'>): Promise<Student> {
  const existing = await findExistingStudent(input);
  if (existing) return existing;
  return createStudent(input);
}

export async function updateStudent(id: string, input: Partial<Student>): Promise<Student | undefined> {
  const { data } = await supabase
    .from('students')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  return data as Student | undefined;
}

export async function getStudentByAuthUserId(authUserId: string): Promise<Student | undefined> {
  const { data } = await supabase
    .from('students')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  return (data ?? undefined) as Student | undefined;
}

/**
 * Creates (or resets) the student's portal login. Runs in the `create-student-login`
 * edge function because it needs the service role key — the returned password is
 * shown to the admin once and never stored, so a lost password means a reset.
 */
export async function createStudentLogin(studentId: string): Promise<StudentCredentials> {
  const { data, error } = await supabase.functions.invoke('create-student-login', {
    body: { student_id: studentId },
  });

  if (error) {
    // A non-2xx response surfaces as a generic message; the useful reason is in the body,
    // which supabase-js hands back untouched on error.context.
    let detail: string | undefined;
    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === 'function') {
      detail = await response.json().then((body: any) => body?.error).catch(() => undefined);
    }
    throw new Error(detail ?? error.message ?? 'Failed to create login');
  }
  if (data?.error) throw new Error(data.error);

  return data as StudentCredentials;
}

export async function getStudentBatches(studentId: string): Promise<BatchStudentMapping[]> {
  const { data } = await supabase
    .from('batch_student_mapping')
    .select('*')
    .eq('student_id', studentId);
  return (data ?? []) as BatchStudentMapping[];
}

export async function getAllBatchStudentMappings(): Promise<BatchStudentMapping[]> {
  const { data } = await supabase
    .from('batch_student_mapping')
    .select('*');
  return (data ?? []) as BatchStudentMapping[];
}

export async function getBatchStudents(batchId: string): Promise<(Student & { mapping: BatchStudentMapping })[]> {
  const { data: mappings } = await supabase
    .from('batch_student_mapping')
    .select('*, students(*)')
    .eq('batch_id', batchId);

  if (!mappings) return [];
  return mappings.map((m: any) => ({
    ...(m.students as Student),
    mapping: { id: m.id, batch_id: m.batch_id, student_id: m.student_id, joined_at: m.joined_at, status: m.status },
  }));
}

export async function addStudentToBatch(studentId: string, batchId: string, totalFee: number): Promise<BatchStudentMapping> {
  const { data } = await supabase
    .from('batch_student_mapping')
    .insert({ student_id: studentId, batch_id: batchId })
    .select()
    .single();
  // Re-adding a previously removed student leaves a stale student_fees row behind (removeStudentFromBatch
  // only deletes the mapping) — upsert without ignoreDuplicates so the fee just entered always overwrites it.
  await supabase
    .from('student_fees')
    .upsert({ student_id: studentId, batch_id: batchId, total_fee: totalFee, paid_amount: 0 }, { onConflict: 'student_id,batch_id' });
  return data as BatchStudentMapping;
}

export async function removeStudentFromBatch(mappingId: string): Promise<void> {
  await supabase.from('batch_student_mapping').delete().eq('id', mappingId);
}
