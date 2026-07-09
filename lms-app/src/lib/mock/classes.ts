import type { Class, ClassEnrollment, Profile } from '@/lib/types';
import { delay } from './auth';

// ── Seed data ────────────────────────────────────────────
export const MOCK_CLASSES: Class[] = [
  {
    id: 'class-001',
    name: 'Introduction to Web Development',
    description: 'Learn HTML, CSS, and JavaScript fundamentals from scratch.',
    subject: 'Web Development',
    admin_id: 'user-admin-001',
    join_code: 'DEB-4X9K',
    is_active: true,
    created_at: '2026-03-01T00:00:00Z',
    student_count: 24,
  },
  {
    id: 'class-002',
    name: 'Python for Data Science',
    description: 'Master Python, Pandas, NumPy, and Matplotlib for data analysis.',
    subject: 'Data Science',
    admin_id: 'user-admin-001',
    join_code: 'DEB-7R2M',
    is_active: true,
    created_at: '2026-03-15T00:00:00Z',
    student_count: 18,
  },
  {
    id: 'class-003',
    name: 'React & Next.js Masterclass',
    description: 'Build production-ready React applications with Next.js App Router.',
    subject: 'Frontend Development',
    admin_id: 'user-admin-001',
    join_code: 'DEB-9KP3',
    is_active: true,
    created_at: '2026-04-01T00:00:00Z',
    student_count: 31,
  },
  {
    id: 'class-004',
    name: 'Database Design & SQL',
    description: 'Relational database design, normalization, and advanced SQL queries.',
    subject: 'Databases',
    admin_id: 'user-admin-001',
    join_code: 'DEB-2LQ8',
    is_active: false,
    created_at: '2026-02-10T00:00:00Z',
    student_count: 12,
  },
];

export const MOCK_ENROLLED_CLASS_IDS = ['class-001', 'class-002', 'class-003'];

export const MOCK_STUDENTS: Profile[] = [
  { id: 's-001', full_name: 'Alex Johnson',    email: 'alex@student.com',    role: 'student', created_at: '2026-03-02T00:00:00Z' },
  { id: 's-002', full_name: 'Priya Sharma',    email: 'priya@student.com',   role: 'student', created_at: '2026-03-03T00:00:00Z' },
  { id: 's-003', full_name: 'Marcus Williams', email: 'marcus@student.com',  role: 'student', created_at: '2026-03-05T00:00:00Z' },
  { id: 's-004', full_name: 'Sofia Chen',      email: 'sofia@student.com',   role: 'student', created_at: '2026-03-08T00:00:00Z' },
  { id: 's-005', full_name: 'James Okafor',    email: 'james@student.com',   role: 'student', created_at: '2026-03-10T00:00:00Z' },
];

// ── API stubs ─────────────────────────────────────────────

export async function getAdminClasses(): Promise<Class[]> {
  await delay();
  return MOCK_CLASSES;
}

export async function getStudentClasses(): Promise<Class[]> {
  await delay();
  return MOCK_CLASSES.filter((c) => MOCK_ENROLLED_CLASS_IDS.includes(c.id));
}

export async function getClassById(id: string): Promise<Class | null> {
  await delay(200);
  return MOCK_CLASSES.find((c) => c.id === id) ?? null;
}

export async function createClass(data: {
  name: string;
  description?: string;
  subject?: string;
}): Promise<Class> {
  await delay(600);
  const newClass: Class = {
    id: `class-${Date.now()}`,
    name: data.name,
    description: data.description,
    subject: data.subject,
    admin_id: 'user-admin-001',
    join_code: generateJoinCode(),
    is_active: true,
    created_at: new Date().toISOString(),
    student_count: 0,
  };
  MOCK_CLASSES.push(newClass);
  return newClass;
}

export async function updateClass(id: string, data: Partial<Class>): Promise<Class> {
  await delay(400);
  const idx = MOCK_CLASSES.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Class not found');
  MOCK_CLASSES[idx] = { ...MOCK_CLASSES[idx], ...data };
  return MOCK_CLASSES[idx];
}

export async function deleteClass(id: string): Promise<void> {
  await delay(400);
  const idx = MOCK_CLASSES.findIndex((c) => c.id === id);
  if (idx !== -1) MOCK_CLASSES.splice(idx, 1);
}

export async function regenerateJoinCode(id: string): Promise<string> {
  await delay(400);
  const idx = MOCK_CLASSES.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Class not found');
  const newCode = generateJoinCode();
  MOCK_CLASSES[idx].join_code = newCode;
  return newCode;
}

export async function joinClass(code: string): Promise<Class> {
  await delay(600);
  const cls = MOCK_CLASSES.find((c) => c.join_code === code.toUpperCase().trim());
  if (!cls) throw new Error('Invalid class code');
  if (!cls.is_active) throw new Error('This class is no longer active');
  if (MOCK_ENROLLED_CLASS_IDS.includes(cls.id)) throw new Error('You have already joined this class');
  MOCK_ENROLLED_CLASS_IDS.push(cls.id);
  return cls;
}

export async function getEnrolledStudents(_classId: string): Promise<Profile[]> {
  await delay();
  return MOCK_STUDENTS;
}

// ── Utility ───────────────────────────────────────────────
function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `DEB-${code}`;
}
