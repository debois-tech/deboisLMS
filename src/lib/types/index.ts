export type Role = 'admin' | 'student';

export type BatchStatus = 'upcoming' | 'ongoing' | 'completed';
export type SessionType = 'online' | 'offline';
export type AttendanceStatus = 'present' | 'partial' | 'absent';
export type AttendanceSource = 'manual' | 'automated';
export type MappingStatus = 'active' | 'dropped';
export type SubmissionChannel = 'whatsapp' | 'other' | 'portal';
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

export interface Batch {
  id: string;
  name: string;
  track?: string;
  status: BatchStatus;
  start_date?: string;
  created_at: string;
  student_count?: number;
}

export interface Student {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  github_url?: string;
  linkedin_url?: string;
  created_at: string;
  /** auth.users id once a portal login has been created for this student. */
  auth_user_id?: string;
}

export interface StudentCredentials {
  email: string;
  password: string;
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
}

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}
