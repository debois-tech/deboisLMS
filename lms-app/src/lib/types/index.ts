// ── All TypeScript interfaces for the LMS ────────────────

export type Role = 'admin' | 'student';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  avatar_url?: string;
  created_at: string;
}

export interface Class {
  id: string;
  name: string;
  description?: string;
  subject?: string;
  admin_id: string;
  join_code: string;
  is_active: boolean;
  created_at: string;
  student_count?: number;
}

export interface ClassEnrollment {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
}

export type MaterialType = 'document' | 'link' | 'text';

export interface StudyMaterial {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  type: MaterialType;
  content?: string;
  file_name?: string;
  file_size?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  class_id: string;
  title: string;
  description: string;
  due_date?: string;
  max_marks: number;
  allow_file: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type SubmissionStatus = 'submitted' | 'graded';

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  text_answer?: string;
  file_path?: string;
  file_name?: string;
  marks_obtained?: number;
  feedback?: string;
  status: SubmissionStatus;
  submitted_at: string;
  graded_at?: string;
  // populated joins
  student?: Profile;
  assignment?: Assignment;
}

export interface Test {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  duration_mins?: number;
  max_marks?: number;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  question_count?: number;
}

export type QuestionType = 'mcq' | 'short_answer';

export interface TestQuestion {
  id: string;
  test_id: string;
  question_text: string;
  question_type: QuestionType;
  options?: string[];
  correct_answer?: string;
  marks: number;
  order_index: number;
}

export type AttemptStatus = 'in_progress' | 'submitted';

export interface TestAttempt {
  id: string;
  test_id: string;
  student_id: string;
  answers: Record<string, string>; // { question_id: answer_text }
  score?: number;
  status: AttemptStatus;
  started_at: string;
  submitted_at?: string;
}

// ── UI utility types ──────────────────────────────────────

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

// ── Dashboard stats ───────────────────────────────────────

export interface AdminStats {
  total_classes: number;
  total_students: number;
  pending_grading: number;
}

export interface ActivityItem {
  id: string;
  text: string;
  timestamp: string;
  type: 'enrollment' | 'submission' | 'material' | 'test';
}
