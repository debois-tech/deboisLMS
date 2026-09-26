export type Role = 'admin' | 'student' | 'tutor';

export type BatchStatus = 'upcoming' | 'ongoing' | 'completed';
export type SessionType = 'online' | 'offline';
export type AttendanceStatus = 'present' | 'partial' | 'absent';
export type AttendanceSource = 'manual' | 'automated';
/** 'dropped' = batch finished and grace window passed. 'terminated' = left mid-batch. */
export type MappingStatus = 'active' | 'dropped' | 'terminated';
/** Students only hand work in through the portal now. */
export type SubmissionChannel = 'portal';
/** Open, not a union: admins mint new codes and the valid set lives in `batch_programs`. */
export type BatchProgram = string;
export type FeeStatus = 'due' | 'paid';
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other';
export type FeedbackKind = 'bug' | 'request';
export type FeedbackStatus = 'open' | 'resolved';
export type ClaimStatus = 'pending' | 'approved' | 'dismissed';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  avatar_url?: string;
  created_at: string;
  /** Only set for role === 'student' — the students.id row this login belongs to. */
  student_id?: string;
  /** Only set for role === 'tutor' — the tutors.id row this login belongs to. */
  tutor_id?: string;
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
  /** Filename prefix for this batch's material, e.g. `DBT-TEPC-2026-D`. */
  batch_code?: string;
  /** Set when the batch was ended. Starts the 30-day countdown on its logins. */
  ended_at?: string | null;
  /** The batch's full fee. Each imported student's fee is this less their discount. */
  base_fee?: number | null;
  created_at: string;
  student_count?: number;
}

export interface Student {
  id: string;
  /** Permanent institution-wide ID, e.g. DBT0001. Issued by the database — never sent on insert. */
  student_code?: string;
  name: string;
  /** Phone/mobile number. Also the source of the portal password suffix. */
  phone: string;
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
  /** auth.users id once a tutor login has been created. */
  auth_user_id?: string;
  /** True once the password was reset to a random one — the derived rule no longer applies. */
  password_rotated?: boolean;
  created_at: string;
}

export interface Lecture {
  id: string;
  batch_id: string;
  lecture_date: string;
  session_type: SessionType;
  meeting_code?: string;
  note?: string;
  scheduled_duration_minutes?: number;
  start_at?: string;
  end_at?: string;
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
  /** What the fee rule said was owed the day they left. Null while enrolled. */
  expected_on_exit?: number | null;
  transferred?: boolean;
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

export interface Feedback {
  id: string;
  student_id: string;
  kind: FeedbackKind;
  message: string;
  page?: string;
  user_agent?: string;
  status: FeedbackStatus;
  created_at: string;
  resolved_at?: string | null;
  student?: Student;
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
  mark: boolean;
  student?: Student;
  assignment?: Assignment;
}

/** Balance only — nothing that reveals what the student was charged. From `student_fee_dues`. */
export interface StudentFeeDue {
  id: string;
  student_id: string;
  batch_id: string;
  amount_due: number;
  status: FeeStatus;
  updated_at?: string;
  /** Milestones covered by what they have paid: 0, 1 or 2. Decided by amount in SQL. */
  paid_through?: number;
}

/** Self-reported "I paid" — a student's claim, not a confirmed payment. Admin still logs the real thing by hand. */
export interface PaymentClaim {
  id: string;
  student_id: string;
  batch_id?: string;
  transaction_id: string;
  amount: number;
  status: ClaimStatus;
  created_at: string;
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
  /** Set only once terminated. */
  left_on?: string | null;
  status: MappingStatus;
}

/** Metadata only; the file lives in the private bucket and is served watermarked. */
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
  /** Null on a PDF/image means it predates upload-time stamping and still needs a backfill. */
  watermarked_at?: string | null;
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

/** Per batch. `pending` is what active students owe; `void_amount` is what leavers never paid. */
export interface EarningBreakdown {
  batch_id: string;
  batch_name: string;
  active_students: number;
  terminated_students: number;
  collected: number;
  collected_active: number;
  collected_terminated: number;
  pending: number;
  void_amount: number;
  never_due: number;
  recovered: number;
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

export type CurriculumKind = 'module' | 'topic' | 'subtopic';
export type CurriculumStatus = 'todo' | 'done' | 'skipped';

export interface CurriculumNode {
  id: string;
  batch_id: string;
  parent_id: string | null;
  kind: CurriculumKind;
  title: string;
  position: number;
  status: CurriculumStatus;
  /** The day it was taught (YYYY-MM-DD). Set only while done. */
  done_on: string | null;
}

/** What a proposal stores per node; status and date stay on the live tree. */
export type CurriculumDraftNode = Pick<CurriculumNode, 'id' | 'parent_id' | 'kind' | 'title' | 'position'>;

/** Artwork made for one batch. `image_path` is a public file in the assets bucket. */
export interface BatchBadge {
  id: string;
  batch_id: string;
  name: string;
  description?: string | null;
  image_path: string;
  created_at?: string;
}

/** One student holding one badge. Deleting the row takes the badge away. */
export interface StudentBadge {
  id: string;
  student_id: string;
  badge_id: string;
  issued_at: string;
}

export interface CurriculumRequest {
  id: string;
  batch_id: string;
  nodes: CurriculumDraftNode[];
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  decided_at: string | null;
}
