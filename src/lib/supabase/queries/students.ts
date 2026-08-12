import { supabase } from '../client';
import { maybeRow, ok, row, rows } from './result';
import type { Batch, Student, BatchStudentMapping, StudentCredentials } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';
import { getImportFee, toStudentInput } from '@/lib/utils/studentImport';

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

/**
 * `student_code` is the database's to issue and never to rewrite, so it is
 * stripped from anything the app sends — a form that round-trips a whole student
 * would otherwise put it back on the wire.
 */
function withoutCode(input: Partial<Student>): Partial<Student> {
  const fields = { ...input };
  delete fields.student_code;
  return fields;
}

export async function createStudent(input: Omit<Student, 'id' | 'created_at'>): Promise<Student> {
  return row<Student>(
    await supabase.from('students').insert(withoutCode(input)).select().single(),
    'Could not create the student',
  );
}

const normalizePhone = (phone: string | undefined | null) => (phone ?? '').replace(/\D/g, '');

/**
 * Finds the student a CSV row refers to, by phone or email only. Name is
 * deliberately not an identity key — two students with the same name used to
 * collapse into one record on import, which is silent data loss.
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

/** Rows that look like an existing student by name alone — shown as a warning, never acted on. */
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

/**
 * The one CSV import path, shared by the students page and a batch's students
 * tab so both write the same fields. Every row is created-or-reused, then
 * enrolled at its own fee; `fallbackFee` covers rows whose sheet left it blank.
 * An enrolment that already exists is the goal, not an error.
 */
export async function importStudentsIntoBatch(
  rows: Record<string, string>[],
  batchId: string,
  fallbackFee?: number,
): Promise<Student[]> {
  return Promise.all(
    rows.map(async (row) => {
      const student = await createOrReuseStudent(toStudentInput(row));
      const fee = getImportFee(row) ?? fallbackFee ?? 0;
      await addStudentToBatch(student.id, batchId, fee).catch(() => undefined);
      return student;
    }),
  );
}

export async function updateStudent(id: string, input: Partial<Student>): Promise<Student | undefined> {
  return maybeRow<Student>(
    await supabase.from('students').update(withoutCode(input)).eq('id', id).select().single(),
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
 * Creates (or resets) the student's portal login, via the `create-student-login`
 * edge function. The password is shown once and never stored — a lost one means a reset.
 */
export async function createStudentLogin(studentId: string): Promise<StudentCredentials> {
  const { data, error } = await supabase.functions.invoke('create-student-login', {
    body: { student_id: studentId },
  });

  if (error) {
    // Non-2xx surfaces as a generic message; the useful reason is on error.context.
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
 * Creates portal logins for a list of students, a few at a time rather than all at
 * once — each call creates an auth user, and firing eighty in parallel gets
 * rate-limited. One student's failure never stops the rest.
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

/** The student's enrolments with each batch joined in — no per-batch round trips. */
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

  // Re-adding a previously removed student leaves a stale student_fees row behind
  // (removeStudentFromBatch only deletes the mapping) — upsert so the fee just
  // entered always overwrites it.
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
