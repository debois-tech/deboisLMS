import { parseCsvTable } from './csvParser.ts';
import { formatCurrency } from './format.ts';
import type { BatchProgram, InternshipRole, Student } from '@/lib/types';

const NAME_ALIASES = ['name', 'full name', 'student name'];

/** Add new fields here. Matched on headers, not column order. */
export const STUDENT_IMPORT_FIELDS = [
  { key: 'name', aliases: NAME_ALIASES },
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

const FEE_ALIASES = ['fee', 'fees', 'decided fee', 'final fee', 'fee amount', 'total fee'];
const DISCOUNT_ALIASES = [
  'discount', 'discount amount', 'discount amt', 'disc',
  'concession', 'waiver', 'scholarship',
];
const BATCH_ALIASES = ['batch', 'batch code', 'program', 'programme', 'course batch'];

/** The gender values the form offers. Free text in the DB, so an import may carry others. */
export const GENDER_OPTIONS = ['Female', 'Male', 'Other', 'Prefer not to say'] as const;

// The role the New Batch form suggests, found by a programme code appearing in the batch's code (most batches carry
// the programme TEP, so the code is what tells them apart) or being the batch's programme. A new programme gets a
// line here once its enum value exists.
const ROLE_BY_CODE: Record<string, InternshipRole> = {
  PHR: 'Devops Engineering Intern',
  AML: 'AI/ML Engineering Intern',
  MCL: 'Cloud Engineering Intern',
};

export function roleForBatch(batch: { program?: BatchProgram; batch_code?: string } | undefined): InternshipRole | undefined {
  const code = Object.keys(ROLE_BY_CODE).find((key) => batch?.batch_code?.toUpperCase().includes(key) || batch?.program === key);
  return code ? ROLE_BY_CODE[code] : undefined;
}

export type StudentImportInput = Omit<Student, 'id' | 'created_at'>;

const normalizeCsvHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Read a cell by any of its accepted header spellings, ignoring case and punctuation. */
export function getImportValue(row: Record<string, string>, aliases: readonly string[]): string | undefined {
  const entry = Object.entries(row).find(([header]) =>
    aliases.some((alias) => normalizeCsvHeader(header) === normalizeCsvHeader(alias)),
  );
  return entry?.[1]?.trim() || undefined;
}

/** Rupees from a cell. Sheets export "4000", "4,000", "₹4,000" and "4000/-" alike; a minus or '%' is not one. */
function toAmount(raw: string): number | undefined {
  const text = raw.replace(/\/-\s*$/, '');
  if (/[%-]/.test(text)) return undefined;
  const cleaned = text.replace(/[^0-9.]/g, '');
  const amount = Number(cleaned);
  return cleaned && Number.isFinite(amount) ? amount : undefined;
}

export type FeePlan = { fee: number; discount: number } | { error: string };

/**
 * What a row is charged. Fee wins over Discount; a Discount is rupees or a percentage of the base; with neither the
 * student is free. The discount kept on the fee row is always base minus fee, in rupees.
 */
export function planImportFee(row: Record<string, string>, base: number): FeePlan {
  const feeCell = getImportValue(row, FEE_ALIASES);
  const discountCell = getImportValue(row, DISCOUNT_ALIASES);
  let fee = 0;

  if (feeCell) {
    const amount = toAmount(feeCell);
    if (amount === undefined) return { error: `Fee "${feeCell}" not a number` };
    fee = amount;
  } else if (discountCell) {
    const percent = discountCell.match(/^(\d+(?:\.\d+)?)\s*%$/)?.[1];
    const discount = percent === undefined ? toAmount(discountCell) : (base * Number(percent)) / 100;
    if (discount === undefined) return { error: `Discount "${discountCell}" not a number` };
    if (discount > base) return { error: `Discount above base ${formatCurrency(base)}` };
    fee = base - discount;
  }

  if (fee > base) return { error: `Fee above base ${formatCurrency(base)}` };
  const rounded = Math.round(fee);
  return { fee: rounded, discount: base - rounded };
}

export interface ImportPlan {
  ready: { row: Record<string, string>; name: string; fee: number; discount: number }[];
  rejected: { name: string; reason: string }[];
}

/** A row the database refused: kept whole so the dialog can offer it for another go. */
export interface ImportFailure {
  row: Record<string, string>;
  name: string;
  reason: string;
}

/** Splits rows into those that can be charged and those named back to the admin with a reason. */
export function planImportRows(rows: Record<string, string>[], base: number): ImportPlan {
  const plan: ImportPlan = { ready: [], rejected: [] };
  for (const row of rows) {
    const result = planImportFee(row, base);
    const name = getImportValue(row, NAME_ALIASES) ?? 'Unnamed row';
    if ('error' in result) plan.rejected.push({ name, reason: result.error });
    else plan.ready.push({ row, name, ...result });
  }
  return plan;
}

export const normalizeRole = (role: string) => role.toLowerCase().replace(/[^a-z0-9]/g, '');
export const cleanRole = (role: string) => role.trim().replace(/\s+/g, ' ');

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
    getImportValue(row, NAME_ALIASES) &&
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
      name: getImportValue(row, NAME_ALIASES) ?? 'Unnamed row',
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
