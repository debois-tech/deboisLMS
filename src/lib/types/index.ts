export type Role = 'admin' | 'student';

export type BatchStatus = 'upcoming' | 'ongoing' | 'completed';
export type SessionType = 'online' | 'offline';
export type AttendanceStatus = 'present' | 'partial' | 'absent';
export type AttendanceSource = 'manual' | 'automated';
export type MappingStatus = 'active' | 'dropped';
/** 'portal' = the student handed it in; 'github' = an admin recorded it. */
export type SubmissionChannel = 'github' | 'portal';
/**
 * A programme abbreviation, e.g. PHR. Open rather than a fixed union: an admin
 * mints new ones from the batch form, and the valid set lives in `batch_programs`.
 */
export type BatchProgram = string;
export type FeeStatus = 'due' | 'paid';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  avatar_url?: string;
  created_at: string;
  /** Only set for role === 'student' — the students.id row this login belongs to. */
  student_id?: string;
}

/** Abbreviation to display name, from the `batch_programs` table. */
export interface BatchProgramOption {
  code: BatchProgram;
  name: string;
  sort_order: number;
}

export interface Batch {
  id: string;
  name: string;
  /** Which programme this batch runs. The UI shows the name, never the code. */
  program?: BatchProgram;
  status: BatchStatus;
  start_date?: string;
  /**
   * Filename prefix for this batch's study material, e.g. `DBT-TEPC-2026-D`.
   * A material's title is this plus an admin-entered suffix: `DBT-TEPC-2026-D01`.
   */
  batch_code?: string;
  created_at: string;
  student_count?: number;
}

export interface Student {
  id: string;
  /** Permanent institution-wide ID, e.g. DBT0001. Issued by the database — never sent on insert. */
  student_code?: string;
  name: string;
  /** WhatsApp number. Also the source of the portal password suffix. */
  phone?: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  college?: string;
  course?: string;
  branch?: string;
  /** Free text: "3rd", "Final year" and "2" all turn up in the sheets. */
  current_year?: string;
  graduation_year?: number;
  github_url?: string;
  linkedin_url?: string;
  created_at: string;
  /** auth.users id once a portal login has been created for this student. */
  auth_user_id?: string;
  /** True once the password was reset to a random one — the derived rule no longer applies. */
  password_rotated?: boolean;
}

export interface StudentCredentials {
  email: string;
  password: string;
  /** True when this came from a reset, so it cannot be recomputed later. */
  rotated?: boolean;
}

export interface Tutor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  created_at: string;
}

export interface Lecture {
  id: string;
  batch_id: string;
  lecture_date: string;
  session_type: SessionType;
  meeting_code?: string;
  scheduled_duration_minutes?: number;
  created_at: string;
}

export interface UploadRow {
  id: string;
  lecture_id?: string;
  sno?: number;
  participant_name_raw: string;
  attendance_started?: string;
  joined_at?: string;
  attendance_stopped?: string;
  attended_duration_raw?: string;
  attended_minutes?: number;
  meeting_code?: string;
  matched_student_id?: string;
  processed: boolean;
  uploaded_at: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  batch_id: string;
  lecture_id: string;
  status: AttendanceStatus;
  total_attended_minutes?: number;
  raw_upload_ids?: string[];
  source: AttendanceSource;
  approved: boolean;
  approved_at?: string;
  created_at: string;
  student?: Student;
  lecture?: Lecture;
}

export interface StudentFee {
  id: string;
  student_id: string;
  batch_id: string;
  total_fee: number;
  paid_amount: number;
  status: FeeStatus;
  updated_at: string;
  student?: Student;
}

export interface FeePaymentLog {
  id: string;
  student_fee_id: string;
  student_id: string;
  batch_id: string;
  amount: number;
  payment_date: string;
  payment_method?: PaymentMethod;
  notes?: string;
  created_at: string;
}

export interface Assignment {
  id: string;
  batch_id: string;
  title: string;
  description?: string;
  assigned_date?: string;
  due_at?: string | null;
  created_at: string;
}

export interface AssignmentCompletion {
  id: string;
  assignment_id: string;
  student_id: string;
  submitted: boolean;
  submitted_via: SubmissionChannel;
  submitted_at?: string;
  marked_by?: string;
  student?: Student;
  assignment?: Assignment;
}

/**
 * What the portal is allowed to know about a fee: the balance, and nothing that
 * would reveal what the student was charged. Backed by the `student_fee_dues`
 * view, which is scoped to the caller in SQL.
 */
export interface StudentFeeDue {
  id: string;
  student_id: string;
  batch_id: string;
  amount_due: number;
  status: FeeStatus;
  updated_at?: string;
}

/** One GitHub repo per student — every assignment submission points at it. */
export interface StudentRepo {
  student_id: string;
  repo_url: string;
  created_at?: string;
  updated_at?: string;
}

export interface BatchStudentMapping {
  id: string;
  batch_id: string;
  student_id: string;
  joined_at: string;
  status: MappingStatus;
}

/**
 * One PDF attached to a batch. The row is metadata only — the file lives in the
 * private `materials` storage bucket and is only ever handed to a student as a
 * watermarked copy produced by the `watermark-material` edge function.
 */
export interface Material {
  id: string;
  /** Null means the material is for every student rather than one batch. */
  batch_id?: string | null;
  /** Set when this is an assignment's handout rather than library material. */
  assignment_id?: string | null;
  /** Decides delivery: paged and watermarked, shown as text, or downloaded. */
  mime_type?: string;
  /** Who the material came from, for the listings. Not part of the watermark. */
  tutor_id?: string | null;
  title: string;
  description?: string;
  /** Folder this came from, when uploaded as part of one. Groups listings only. */
  folder?: string | null;
  storage_path: string;
  size_bytes?: number;
  page_count?: number;
  uploaded_by?: string;
  created_at: string;
  batch?: Batch;
  tutor?: Tutor;
}

export interface MaterialView {
  id: string;
  material_id: string;
  student_id: string;
  viewed_at: string;
  student?: Student;
}

export interface TutorBatchMapping {
  id: string;
  tutor_id: string;
  batch_id: string;
  assigned_at: string;
}

export interface BatchFeeSummary {
  batch_id: string;
  batch_name: string;
  total_students: number;
  total_fees: number;
  total_collected: number;
  total_outstanding: number;
}

export interface BatchAttendanceSummary {
  batch_id: string;
  batch_name: string;
  total_lectures: number;
  present_count: number;
  partial_count: number;
  absent_count: number;
  pending_approval: number;
}

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Set for the length of the exit animation, just before the toast is dropped. */
  leaving?: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}
