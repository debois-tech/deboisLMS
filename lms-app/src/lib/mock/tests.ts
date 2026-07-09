import type { Test, TestQuestion, TestAttempt } from '@/lib/types';
import { delay } from './auth';

const MOCK_TESTS: Test[] = [
  {
    id: 'test-001',
    class_id: 'class-001',
    title: 'HTML & CSS Fundamentals Quiz',
    description: 'Test your knowledge of core HTML elements and CSS properties.',
    duration_mins: 20,
    max_marks: 10,
    is_published: true,
    created_by: 'user-admin-001',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    question_count: 5,
  },
  {
    id: 'test-002',
    class_id: 'class-001',
    title: 'JavaScript Basics',
    description: 'Covers variables, data types, functions, and basic DOM manipulation.',
    duration_mins: 30,
    max_marks: 15,
    is_published: false,
    created_by: 'user-admin-001',
    created_at: '2026-07-05T00:00:00Z',
    updated_at: '2026-07-05T00:00:00Z',
    question_count: 8,
  },
  {
    id: 'test-003',
    class_id: 'class-002',
    title: 'Python Data Types Quiz',
    description: 'Test on lists, dicts, tuples, and set operations.',
    duration_mins: 15,
    max_marks: 8,
    is_published: true,
    created_by: 'user-admin-001',
    created_at: '2026-07-08T00:00:00Z',
    updated_at: '2026-07-08T00:00:00Z',
    question_count: 4,
  },
];

const MOCK_QUESTIONS: TestQuestion[] = [
  {
    id: 'q-001', test_id: 'test-001', order_index: 0,
    question_text: 'Which HTML element is used to define the largest heading?',
    question_type: 'mcq',
    options: ['<h6>', '<heading>', '<h1>', '<head>'],
    correct_answer: '<h1>',
    marks: 2,
  },
  {
    id: 'q-002', test_id: 'test-001', order_index: 1,
    question_text: 'Which CSS property controls the text size?',
    question_type: 'mcq',
    options: ['text-style', 'font-size', 'text-size', 'font-weight'],
    correct_answer: 'font-size',
    marks: 2,
  },
  {
    id: 'q-003', test_id: 'test-001', order_index: 2,
    question_text: 'What does CSS stand for?',
    question_type: 'mcq',
    options: ['Colorful Style Sheets', 'Computer Style Sheets', 'Cascading Style Sheets', 'Creative Style Sheets'],
    correct_answer: 'Cascading Style Sheets',
    marks: 2,
  },
  {
    id: 'q-004', test_id: 'test-001', order_index: 3,
    question_text: 'Explain the difference between `id` and `class` attributes in HTML.',
    question_type: 'short_answer',
    correct_answer: 'id is unique per page and used for a single element; class can be used on multiple elements.',
    marks: 4,
  },
];

const MOCK_ATTEMPTS: TestAttempt[] = [
  {
    id: 'attempt-001',
    test_id: 'test-001',
    student_id: 's-001',
    answers: { 'q-001': '<h1>', 'q-002': 'font-size', 'q-003': 'Cascading Style Sheets', 'q-004': 'id is unique, class can be reused' },
    score: 6,
    status: 'submitted',
    started_at: '2026-07-09T08:00:00Z',
    submitted_at: '2026-07-09T08:18:00Z',
  },
];

export async function getTestsByClass(classId: string): Promise<Test[]> {
  await delay();
  return MOCK_TESTS.filter((t) => t.class_id === classId);
}

export async function getTestById(id: string): Promise<Test | null> {
  await delay(200);
  return MOCK_TESTS.find((t) => t.id === id) ?? null;
}

export async function getQuestionsByTest(testId: string): Promise<TestQuestion[]> {
  await delay();
  return MOCK_QUESTIONS.filter((q) => q.test_id === testId).sort((a, b) => a.order_index - b.order_index);
}

export async function getMyAttempt(testId: string, studentId: string): Promise<TestAttempt | null> {
  await delay(200);
  return MOCK_ATTEMPTS.find((a) => a.test_id === testId && a.student_id === studentId) ?? null;
}

export async function createTest(data: Omit<Test, 'id' | 'created_at' | 'updated_at' | 'question_count'>): Promise<Test> {
  await delay(600);
  const test: Test = {
    ...data,
    id: `test-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    question_count: 0,
  };
  MOCK_TESTS.push(test);
  return test;
}

export async function addQuestion(data: Omit<TestQuestion, 'id'>): Promise<TestQuestion> {
  await delay(300);
  const q: TestQuestion = { ...data, id: `q-${Date.now()}` };
  MOCK_QUESTIONS.push(q);
  return q;
}

export async function publishTest(id: string, publish: boolean): Promise<void> {
  await delay(300);
  const t = MOCK_TESTS.find((t) => t.id === id);
  if (t) t.is_published = publish;
}

export async function submitTest(
  testId: string,
  studentId: string,
  answers: Record<string, string>
): Promise<TestAttempt> {
  await delay(800);
  // Auto-grade MCQ
  const questions = MOCK_QUESTIONS.filter((q) => q.test_id === testId && q.question_type === 'mcq');
  let score = 0;
  for (const q of questions) {
    if (answers[q.id] === q.correct_answer) score += q.marks;
  }

  const attempt: TestAttempt = {
    id: `attempt-${Date.now()}`,
    test_id: testId,
    student_id: studentId,
    answers,
    score,
    status: 'submitted',
    started_at: new Date(Date.now() - 300000).toISOString(),
    submitted_at: new Date().toISOString(),
  };
  MOCK_ATTEMPTS.push(attempt);
  return attempt;
}

export async function getAllAttempts(testId: string): Promise<TestAttempt[]> {
  await delay();
  return MOCK_ATTEMPTS.filter((a) => a.test_id === testId);
}
