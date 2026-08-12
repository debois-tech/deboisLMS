import { parseCsvTable } from '@/lib/utils/csvParser';
import type { BatchProgram, Student } from '@/lib/types';

/**
 * Add future student fields here. Matching uses headers, not column positions, so
 * a sheet can carry them in any order and spell them however the intake form did.
 */
export const STUDENT_IMPORT_FIELDS = [
  { key: 'name', aliases: ['name', 'full name', 'student name'] },
  { key: 'phone', aliases: ['phone', 'ph no', 'phone number', 'mobile', 'whatsapp', 'whatsapp number', 'whatsapp no'] },
  { key: 'email', aliases: ['email', 'email address', 'mail'] },
  { key: 'date_of_birth', aliases: ['dob', 'date of birth', 'birth date', 'birthdate'] },
  { key: 'gender', aliases: ['gender', 'sex'] },
  { key: 'college', aliases: ['college', 'university', 'college name', 'university name', 'college/university name', 'institute'] },
  { key: 'course', aliases: ['course', 'degree', 'course/degree', 'course degree'] },
  { key: 'branch', aliases: ['branch', 'specialization', 'specialisation', 'branch/specialization', 'branch specialization', 'stream'] },
  { key: 'current_year', aliases: ['current year', 'year', 'study year'] },
  { key: 'graduation_year', aliases: ['graduation year', 'grad year', 'passing year', 'year of passing'] },
  { key: 'github_url', aliases: ['github', 'github link', 'github url', 'githublink', 'github profile', 'github profile url'] },
  { key: 'linkedin_url', aliases: ['linkedin', 'linkedin link', 'linkedin url', 'linkedinlink', 'linkedin profile', 'linkedin profile url'] },
] as const;

const FEE_ALIASES = ['fees', 'fee', 'total fee', 'amount', 'fee amount'];
const BATCH_ALIASES = ['batch', 'batch code', 'program', 'programme', 'course batch'];

/** The abbreviations the CSV may carry. Mirrors the `batch_program` enum. */
export const BATCH_PROGRAM_CODES: readonly BatchProgram[] = ['PHR', 'AML', 'MCL'];

export type StudentImportInput = Omit<Student, 'id' | 'created_at'>;

const normalizeCsvHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Read a cell by any of its accepted header spellings, ignoring case and punctuation. */
export function getImportValue(row: Record<string, string>, aliases: readonly string[]): string | undefined {
  const entry = Object.entries(row).find(([header]) =>
    aliases.some((alias) => normalizeCsvHeader(header) === normalizeCsvHeader(alias)),
  );
  return entry?.[1]?.trim() || undefined;
}

/** The row's fee, or undefined when the column is absent or not a number. */
export function getImportFee(row: Record<string, string>): number | undefined {
  const raw = getImportValue(row, FEE_ALIASES);
  if (!raw) return undefined;
  // Sheets export "₹15,000" and "15000.00" alike.
  const amount = Number(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

/**
 * The row's programme abbreviation. `null` means the column was present but held
 * something that is not one of the three — worth reporting, unlike a blank.
 */
export function getImportProgram(row: Record<string, string>): BatchProgram | null | undefined {
  const raw = getImportValue(row, BATCH_ALIASES);
  if (!raw) return undefined;
  const code = raw.toUpperCase().trim();
  return (BATCH_PROGRAM_CODES as readonly string[]).includes(code) ? (code as BatchProgram) : null;
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
  const rows = table.rows.filter((row) => getImportValue(row, ['name', 'full name', 'student name']));
  return {
    headers: table.headers,
    rows,
    error:
      !table.headers.length || !rows.length
        ? 'CSV needs a Name column and one student row.'
        : '',
  };
}

/**
 * Rows whose Batch column names a programme other than the one being imported
 * into. Returned rather than thrown so the dialog can name them before anything
 * is written — a mixed sheet is the sign of the wrong file, not a bad row.
 */
export function findProgramMismatches(
  rows: Record<string, string>[],
  target: BatchProgram,
): { name: string; found: string }[] {
  return rows.flatMap((row) => {
    const program = getImportProgram(row);
    if (program === undefined || program === target) return [];
    return [{
      name: getImportValue(row, ['name', 'full name', 'student name']) ?? 'Unnamed row',
      found: getImportValue(row, BATCH_ALIASES) ?? '—',
    }];
  });
}

const toYear = (value: string | undefined): number | undefined => {
  const year = Number((value ?? '').replace(/[^0-9]/g, ''));
  return Number.isInteger(year) && year > 1900 && year < 2200 ? year : undefined;
};

/** Sheets write dates every way there is; only an unambiguous one is kept. */
const toIsoDate = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;
  const dmy = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!dmy) return undefined;
  const [, day, month, year] = dmy;
  if (Number(month) > 12) return undefined;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

export function toStudentInput(row: Record<string, string>): StudentImportInput {
  const input = STUDENT_IMPORT_FIELDS.reduce<Record<string, unknown>>((student, field) => {
    const value = getImportValue(row, field.aliases);
    if (value) student[field.key] = value;
    return student;
  }, {});

  // Three fields are not plain text: a blank beats a wrong guess on all of them.
  input.date_of_birth = toIsoDate(input.date_of_birth as string | undefined);
  input.graduation_year = toYear(input.graduation_year as string | undefined);
  if (!input.date_of_birth) delete input.date_of_birth;
  if (!input.graduation_year) delete input.graduation_year;

  return input as StudentImportInput;
}
