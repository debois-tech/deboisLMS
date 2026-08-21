import { parseCsvTable } from '@/lib/utils/csvParser';
import type { BatchProgram, Student } from '@/lib/types';

/** Add new fields here. Matched on headers, not column order. */
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

const DISCOUNT_ALIASES = [
  'discount', 'discount amount', 'discount amt', 'disc',
  'concession', 'waiver', 'scholarship',
];
const BATCH_ALIASES = ['batch', 'batch code', 'program', 'programme', 'course batch'];

/** The gender values the form offers. Free text in the DB, so an import may carry others. */
export const GENDER_OPTIONS = ['Female', 'Male', 'Other', 'Prefer not to say'] as const;

export type StudentImportInput = Omit<Student, 'id' | 'created_at'>;

const normalizeCsvHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Read a cell by any of its accepted header spellings, ignoring case and punctuation. */
export function getImportValue(row: Record<string, string>, aliases: readonly string[]): string | undefined {
  const entry = Object.entries(row).find(([header]) =>
    aliases.some((alias) => normalizeCsvHeader(header) === normalizeCsvHeader(alias)),
  );
  return entry?.[1]?.trim() || undefined;
}

/** The row's discount in rupees off the batch fee. Undefined when blank or unreadable. */
export function getImportDiscount(row: Record<string, string>): number | undefined {
  const raw = getImportValue(row, DISCOUNT_ALIASES);
  if (!raw) return undefined;
  // Sheets export "4000", "4,000", "₹4,000" and "4000/-" alike.
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const amount = Number(cleaned);
  return cleaned && Number.isFinite(amount) ? amount : undefined;
}

/** Rows whose Discount cell is filled but isn't an amount the fee can absorb — returned, not thrown. */
export function findDiscountProblems(
  rows: Record<string, string>[],
  baseFee: number | null,
): { name: string; found: string }[] {
  return rows.flatMap((row) => {
    const raw = getImportValue(row, DISCOUNT_ALIASES);
    if (!raw) return [];
    const amount = getImportDiscount(row);
    // A '%' or a minus means the cell holds something other than rupees off the fee.
    const usable =
      amount !== undefined &&
      !/[%-]/.test(raw) &&
      (baseFee === null || amount <= baseFee);
    if (usable) return [];
    return [{
      name: getImportValue(row, ['name', 'full name', 'student name']) ?? 'Unnamed row',
      found: raw,
    }];
  });
}

/** The row's programme abbreviation, normalised. Valid codes live in `batch_programs`. */
export function getImportProgram(row: Record<string, string>): BatchProgram | undefined {
  return getImportValue(row, BATCH_ALIASES)?.toUpperCase().trim();
}

export interface ParsedStudentCsv {
  headers: string[];
  rows: Record<string, string>[];
  // Rows dropped for a missing required field.
  skipped: number;
  // Empty when the file is usable.
  error: string;
}

// Name, email and date of birth are not null in the database, so a row missing
// any of them cannot become a student. Dropped here rather than failing the
// whole import on the insert.
export function parseStudentCsv(text: string): ParsedStudentCsv {
  const table = parseCsvTable(text);
  const rows = table.rows.filter((row) =>
    getImportValue(row, ['name', 'full name', 'student name']) &&
    getImportValue(row, ['email', 'email address', 'mail']) &&
    toIsoDate(getImportValue(row, ['dob', 'date of birth', 'birth date', 'birthdate'])),
  );
  return {
    headers: table.headers,
    rows,
    skipped: table.rows.length - rows.length,
    error:
      !table.headers.length || !rows.length
        ? 'CSV needs Name, Email and Date of Birth columns, and one usable row.'
        : '',
  };
}

/** Rows naming another programme — returned, not thrown, so the dialog can list them first. */
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
