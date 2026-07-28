import { supabase } from '../client';
import type { Student, BatchStudentMapping } from '@/lib/types';

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

export async function updateStudent(id: string, input: Partial<Student>): Promise<Student | undefined> {
  const { data } = await supabase
    .from('students')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  return data as Student | undefined;
}

export async function getStudentBatches(studentId: string): Promise<BatchStudentMapping[]> {
  const { data } = await supabase
    .from('batch_student_mapping')
    .select('*')
    .eq('student_id', studentId);
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

export async function addStudentToBatch(studentId: string, batchId: string): Promise<BatchStudentMapping> {
  const { data } = await supabase
    .from('batch_student_mapping')
    .insert({ student_id: studentId, batch_id: batchId })
    .select()
    .single();
  return data as BatchStudentMapping;
}

export async function removeStudentFromBatch(mappingId: string): Promise<void> {
  await supabase.from('batch_student_mapping').delete().eq('id', mappingId);
}