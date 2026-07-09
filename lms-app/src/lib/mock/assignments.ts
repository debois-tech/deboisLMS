import type { Assignment, AssignmentSubmission } from '@/lib/types';
import { delay } from './auth';
import { MOCK_STUDENTS } from './classes';

const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: 'asgn-001',
    class_id: 'class-001',
    title: 'Build a Personal Portfolio Website',
    description: 'Create a responsive personal portfolio website using HTML and CSS. Include: a hero section, about section, projects section, and contact form.\n\n**Requirements:**\n- Responsive on mobile and desktop\n- Use semantic HTML5 elements\n- Custom CSS (no frameworks)\n- At least 3 sections',
    due_date: '2026-07-20T23:59:00Z',
    max_marks: 100,
    allow_file: true,
    created_by: 'user-admin-001',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
  },
  {
    id: 'asgn-002',
    class_id: 'class-001',
    title: 'JavaScript DOM Manipulation Exercise',
    description: 'Complete the provided starter code to build an interactive to-do list with add, complete, and delete functionality.',
    due_date: '2026-07-10T23:59:00Z',
    max_marks: 50,
    allow_file: true,
    created_by: 'user-admin-001',
    created_at: '2026-07-02T00:00:00Z',
    updated_at: '2026-07-02T00:00:00Z',
  },
  {
    id: 'asgn-003',
    class_id: 'class-002',
    title: 'Data Analysis with Pandas',
    description: 'Analyze the provided sales dataset using Pandas. Answer the 5 questions below and visualize 2 insights using Matplotlib.',
    due_date: '2026-07-25T23:59:00Z',
    max_marks: 80,
    allow_file: true,
    created_by: 'user-admin-001',
    created_at: '2026-07-03T00:00:00Z',
    updated_at: '2026-07-03T00:00:00Z',
  },
  {
    id: 'asgn-004',
    class_id: 'class-003',
    title: 'Build a Blog with Next.js App Router',
    description: 'Implement a simple blog with dynamic routing using the App Router. Use static data (no database required).',
    due_date: '2026-08-01T23:59:00Z',
    max_marks: 120,
    allow_file: false,
    created_by: 'user-admin-001',
    created_at: '2026-07-05T00:00:00Z',
    updated_at: '2026-07-05T00:00:00Z',
  },
];

const MOCK_SUBMISSIONS: AssignmentSubmission[] = [
  {
    id: 'sub-001',
    assignment_id: 'asgn-002',
    student_id: 's-001',
    text_answer: 'I completed the to-do list with all three features. The add function uses createElement and appendChild. I also added a counter showing remaining tasks.',
    status: 'graded',
    marks_obtained: 45,
    feedback: 'Great work! Clean code structure. Minor: could use event delegation for better performance.',
    submitted_at: '2026-07-08T15:30:00Z',
    graded_at: '2026-07-09T10:00:00Z',
    student: MOCK_STUDENTS[0],
  },
  {
    id: 'sub-002',
    assignment_id: 'asgn-002',
    student_id: 's-002',
    text_answer: 'Completed the task. Used querySelector and addEventListener.',
    status: 'submitted',
    submitted_at: '2026-07-09T09:00:00Z',
    student: MOCK_STUDENTS[1],
  },
  {
    id: 'sub-003',
    assignment_id: 'asgn-001',
    student_id: 's-001',
    text_answer: 'My portfolio is deployed at https://example.com. I used CSS Grid for the projects section.',
    file_name: 'portfolio.zip',
    status: 'submitted',
    submitted_at: '2026-07-15T20:00:00Z',
    student: MOCK_STUDENTS[0],
  },
];

export async function getAssignmentsByClass(classId: string): Promise<Assignment[]> {
  await delay();
  return MOCK_ASSIGNMENTS.filter((a) => a.class_id === classId);
}

export async function getAssignmentById(id: string): Promise<Assignment | null> {
  await delay(200);
  return MOCK_ASSIGNMENTS.find((a) => a.id === id) ?? null;
}

export async function createAssignment(data: Omit<Assignment, 'id' | 'created_at' | 'updated_at'>): Promise<Assignment> {
  await delay(600);
  const asgn: Assignment = {
    ...data,
    id: `asgn-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_ASSIGNMENTS.push(asgn);
  return asgn;
}

export async function updateAssignment(id: string, data: Partial<Assignment>): Promise<Assignment> {
  await delay(400);
  const idx = MOCK_ASSIGNMENTS.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error('Assignment not found');
  MOCK_ASSIGNMENTS[idx] = { ...MOCK_ASSIGNMENTS[idx], ...data, updated_at: new Date().toISOString() };
  return MOCK_ASSIGNMENTS[idx];
}

export async function getSubmissionsByAssignment(assignmentId: string): Promise<AssignmentSubmission[]> {
  await delay();
  return MOCK_SUBMISSIONS.filter((s) => s.assignment_id === assignmentId);
}

export async function getMySubmission(assignmentId: string, studentId: string): Promise<AssignmentSubmission | null> {
  await delay(200);
  return MOCK_SUBMISSIONS.find((s) => s.assignment_id === assignmentId && s.student_id === studentId) ?? null;
}

export async function submitAssignment(data: {
  assignment_id: string;
  student_id: string;
  text_answer?: string;
  file_name?: string;
}): Promise<AssignmentSubmission> {
  await delay(700);
  const sub: AssignmentSubmission = {
    id: `sub-${Date.now()}`,
    ...data,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  };
  MOCK_SUBMISSIONS.push(sub);
  return sub;
}

export async function gradeSubmission(id: string, marks: number, feedback: string): Promise<AssignmentSubmission> {
  await delay(500);
  const idx = MOCK_SUBMISSIONS.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error('Submission not found');
  MOCK_SUBMISSIONS[idx] = {
    ...MOCK_SUBMISSIONS[idx],
    marks_obtained: marks,
    feedback,
    status: 'graded',
    graded_at: new Date().toISOString(),
  };
  return MOCK_SUBMISSIONS[idx];
}

export async function getPendingGradingCount(): Promise<number> {
  await delay(100);
  return MOCK_SUBMISSIONS.filter((s) => s.status === 'submitted').length;
}
