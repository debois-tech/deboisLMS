import { supabase } from '../client';
import { maybeRow, ok, row, rows } from './result';
import type { Batch, Student, BatchStudentMapping, StudentCredentials } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';

export async function getStudents(): Promise<Student[]> {
  return rows<Student>(
    await supabase.from('students').select('*').order('created_at', { ascending: false }),
    'Could not load students',
  );
}

export async function getStudentById(id: string): Promise<Student | undefined> {
  return maybeRow<Student>(
    await supabase.from('students').select('*').eq('id', id).single(),
    'Could not load this student',
  );
}

export async function createStudent(input: Omit<Student, 'id' | 'created_at'>): Promise<Student> {
  return row<Student>(
    await supabase.from('students').insert(input).select().single(),
    'Could not create the student',
  );
}

const normalizePhone = (phone: string | undefined | null) => (phone ?? '').replace(/\D/g, '');

/**
 * Finds the student a CSV row refers to, by **phone or email only**.
 *
 * Name is deliberately not an identity key. It used to be, and two students
 * called "Rahul Sharma" would collapse into one record on import — sharing a
 * portal login, attendance, fees and assignments, with no way to tell afterwards
 * that it had happened. A duplicate row is a nuisance an admin can merge; a
 * silent merge of two people is data loss.
 */
export async function findExistingStudent(input: { name?: string; phone?: string; email?: string }): Promise<Student | undefined> {
  const phone = normalizePhone(input.phone);
  const email = input.email?.trim().toLowerCase();
  if (!phone && !email) return undefined;

  const students = rows<Student>(
    await supabase.from('students').select('*'),
    'Could not check for an existing student',
  );

  return students.find((s) => {
    if (phone && s.phone && normalizePhone(s.phone) === phone) return true;
    if (email && s.email && s.email.trim().toLowerCase() === email) return true;
    return false;
  });
}

/**
 * Rows that look like an existing student by name alone. The import preview
 * shows these as a warning so the admin can decide — the import itself never
 * acts on a name match.
 */
export async function findNameCollisions(names: string[]): Promise<string[]> {
  const wanted = new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean));
  if (wanted.size === 0) return [];

  const students = rows<Student>(
    await supabase.from('students').select('*'),
    'Could not check for duplicate names',
  );

  return students
    .filter((s) => wanted.has(s.name.trim().toLowerCase()))
    .map((s) => s.name);
}

export async function createOrReuseStudent(input: Omit<Student, 'id' | 'created_at'>): Promise<Student> {
  const existing = await findExistingStudent(input);
  if (existing) return existing;
  return createStudent(input);
}

export async function updateStudent(id: string, input: Partial<Student>): Promise<Student | undefined> {
  return maybeRow<Student>(
    await supabase.from('students').update(input).eq('id', id).select().single(),
    'Could not save the student',
  );
}

export async function getStudentByAuthUserId(authUserId: string): Promise<Student | undefined> {
  return maybeRow<Student>(
    await supabase.from('students').select('*').eq('auth_user_id', authUserId).maybeSingle(),
    'Could not load your student record',
  );
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
      detail = await response
        .json()
        .then((body: { error?: string } | null) => body?.error)
        .catch(() => undefined);
    }
    throw new Error(detail ?? error.message ?? 'Failed to create login');
  }
  if (data?.error) throw new Error(data.error);

  return data as StudentCredentials;
}

export interface BulkLoginResult {
  created: (StudentCredentials & { studentId: string; name: string })[];
  failed: { studentId: string; name: string; reason: string }[];
}

/**
 * Creates portal logins for a list of students, e.g. straight after a CSV import.
 *
 * Runs a few at a time rather than all at once: each call is an edge function
 * invocation that creates an auth user, and firing eighty of those in parallel
 * gets rate-limited. One student's failure — usually a missing email — never
 * stops the rest; it comes back in `failed` so the admin can see who to fix.
 */
export async function createStudentLoginsBulk(
  students: { id: string; name: string }[],
  onProgress?: (done: number, total: number) => void,
): Promise<BulkLoginResult> {
  const result: BulkLoginResult = { created: [], failed: [] };
  const BATCH_SIZE = 4;
  let done = 0;

  for (let index = 0; index < students.length; index += BATCH_SIZE) {
    const slice = students.slice(index, index + BATCH_SIZE);

    await Promise.all(slice.map(async (student) => {
      try {
        const credentials = await createStudentLogin(student.id);
        result.created.push({ ...credentials, studentId: student.id, name: student.name });
      } catch (err) {
        result.failed.push({
          studentId: student.id,
          name: student.name,
          reason: errorMessage(err, 'Failed'),
        });
      } finally {
        done += 1;
        onProgress?.(done, students.length);
      }
    }));
  }

  return result;
}

/**
 * The student's enrolments with each batch joined in. The batch used to be
 * fetched per mapping by the pages that needed its name, which cost one round
 * trip per batch on the portal's landing page.
 */
export async function getStudentBatches(studentId: string): Promise<(BatchStudentMapping & { batch?: Batch })[]> {
  return rows<BatchStudentMapping & { batch?: Batch }>(
    await supabase
      .from('batch_student_mapping')
      .select('*, batch:batches(*)')
      .eq('student_id', studentId),
    'Could not load your batches',
  );
}

export async function getAllBatchStudentMappings(): Promise<BatchStudentMapping[]> {
  return rows<BatchStudentMapping>(
    await supabase.from('batch_student_mapping').select('*'),
    'Could not load enrolments',
  );
}

export async function getBatchStudents(batchId: string): Promise<(Student & { mapping: BatchStudentMapping })[]> {
  const mappings = rows<BatchStudentMapping & { students: Student }>(
    await supabase.from('batch_student_mapping').select('*, students(*)').eq('batch_id', batchId),
    'Could not load the batch roster',
  );

  return mappings.map((m) => ({
    ...m.students,
    mapping: { id: m.id, batch_id: m.batch_id, student_id: m.student_id, joined_at: m.joined_at, status: m.status },
  }));
}

export async function addStudentToBatch(studentId: string, batchId: string, totalFee: number): Promise<BatchStudentMapping> {
  const mapping = row<BatchStudentMapping>(
    await supabase
      .from('batch_student_mapping')
      .insert({ student_id: studentId, batch_id: batchId })
      .select()
      .single(),
    'Could not add the student to the batch',
  );

  // Re-adding a previously removed student leaves a stale student_fees row behind (removeStudentFromBatch
  // only deletes the mapping) — upsert without ignoreDuplicates so the fee just entered always overwrites it.
  ok(
    await supabase
      .from('student_fees')
      .upsert(
        { student_id: studentId, batch_id: batchId, total_fee: totalFee, paid_amount: 0 },
        { onConflict: 'student_id,batch_id' },
      ),
    'Student was added but the fee could not be set',
  );

  return mapping;
}

export async function removeStudentFromBatch(mappingId: string): Promise<void> {
  ok(
    await supabase.from('batch_student_mapping').delete().eq('id', mappingId),
    'Could not remove the student from the batch',
  );
}
