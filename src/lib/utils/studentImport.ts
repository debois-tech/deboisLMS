import { parseCsvTable } from '@/lib/utils/csvParser';
import type { Student } from '@/lib/types';

/** Add future student fields here. Matching uses headers, not column positions. */
export const STUDENT_IMPORT_FIELDS = [
  { key: 'name', aliases: ['name', 'full name', 'student name'] },
  { key: 'phone', aliases: ['phone', 'ph no', 'phone number', 'mobile'] },
  { key: 'email', aliases: ['email', 'email address'] },
  { key: 'github_url', aliases: ['github', 'github link', 'github url', 'githublink'] },
  { key: 'linkedin_url', aliases: ['linkedin', 'linkedin link', 'linkedin url', 'linkedinlink'] },
] as const;

export type StudentImportInput = Omit<Student, 'id' | 'created_at'>;

const normalizeCsvHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Read a cell by any of its accepted header spellings, ignoring case and punctuation. */
export function getImportValue(row: Record<string, string>, aliases: readonly string[]): string | undefined {
  const entry = Object.entries(row).find(([header]) =>
    aliases.some((alias) => normalizeCsvHeader(header) === normalizeCsvHeader(alias)),
  );
  return entry?.[1]?.trim() || undefined;
}

export interface ParsedStudentCsv {
  headers: string[];
  rows: Record<string, string>[];
  /** Empty when the file is usable. */
  error: string;
}

/** Rows without a name are dropped — they cannot produce a student. */
export function parseStudentCsv(text: string): ParsedStudentCsv {
  const table = parseCsvTable(text);
  const rows = table.rows.filter((row) => getImportValue(row, ['name']));
  return {
    headers: table.headers,
    rows,
    error:
      !table.headers.length || !rows.length
        ? 'CSV needs a Name column and one student row.'
        : '',
  };
}

export function toStudentInput(row: Record<string, string>): StudentImportInput {
  const input = STUDENT_IMPORT_FIELDS.reduce<Record<string, string>>((student, field) => {
    const value = getImportValue(row, field.aliases);
    if (value) student[field.key] = value;
    return student;
  }, {});
  return input as StudentImportInput;
}
