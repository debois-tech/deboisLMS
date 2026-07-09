import type { StudyMaterial } from '@/lib/types';
import { delay } from './auth';

const MOCK_MATERIALS: StudyMaterial[] = [
  {
    id: 'mat-001',
    class_id: 'class-001',
    title: 'HTML5 Complete Reference',
    description: 'Comprehensive guide to all HTML5 elements and attributes.',
    type: 'document',
    content: '/uploads/html5-reference.pdf',
    file_name: 'html5-reference.pdf',
    file_size: 2456000,
    created_by: 'user-admin-001',
    created_at: '2026-03-05T10:00:00Z',
    updated_at: '2026-03-05T10:00:00Z',
  },
  {
    id: 'mat-002',
    class_id: 'class-001',
    title: 'CSS Flexbox & Grid Tutorial',
    description: 'Interactive video tutorial on modern CSS layout techniques.',
    type: 'link',
    content: 'https://youtube.com/watch?v=example',
    created_by: 'user-admin-001',
    created_at: '2026-03-08T14:00:00Z',
    updated_at: '2026-03-08T14:00:00Z',
  },
  {
    id: 'mat-003',
    class_id: 'class-001',
    title: 'Week 1 — Lecture Notes',
    description: 'Notes from the introductory lecture covering web fundamentals.',
    type: 'text',
    content: `# Week 1 — Web Fundamentals\n\nThe web is built on three core technologies:\n\n1. **HTML** — Structure and content\n2. **CSS** — Presentation and styling\n3. **JavaScript** — Behaviour and interactivity\n\n## How the Browser Works\nWhen you type a URL, the browser sends an HTTP request to a server. The server responds with HTML, which the browser parses to build the DOM tree...`,
    created_by: 'user-admin-001',
    created_at: '2026-03-10T09:00:00Z',
    updated_at: '2026-03-12T11:00:00Z',
  },
  {
    id: 'mat-004',
    class_id: 'class-002',
    title: 'Pandas Documentation',
    type: 'link',
    content: 'https://pandas.pydata.org/docs/',
    created_by: 'user-admin-001',
    created_at: '2026-03-16T10:00:00Z',
    updated_at: '2026-03-16T10:00:00Z',
  },
  {
    id: 'mat-005',
    class_id: 'class-003',
    title: 'Next.js App Router Guide',
    type: 'link',
    content: 'https://nextjs.org/docs/app',
    created_by: 'user-admin-001',
    created_at: '2026-04-02T10:00:00Z',
    updated_at: '2026-04-02T10:00:00Z',
  },
];

export async function getMaterialsByClass(classId: string): Promise<StudyMaterial[]> {
  await delay();
  return MOCK_MATERIALS.filter((m) => m.class_id === classId);
}

export async function getMaterialById(id: string): Promise<StudyMaterial | null> {
  await delay(200);
  return MOCK_MATERIALS.find((m) => m.id === id) ?? null;
}

export async function createMaterial(data: Omit<StudyMaterial, 'id' | 'created_at' | 'updated_at'>): Promise<StudyMaterial> {
  await delay(600);
  const mat: StudyMaterial = {
    ...data,
    id: `mat-${Date.now()}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  MOCK_MATERIALS.push(mat);
  return mat;
}

export async function updateMaterial(id: string, data: Partial<StudyMaterial>): Promise<StudyMaterial> {
  await delay(400);
  const idx = MOCK_MATERIALS.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error('Material not found');
  MOCK_MATERIALS[idx] = { ...MOCK_MATERIALS[idx], ...data, updated_at: new Date().toISOString() };
  return MOCK_MATERIALS[idx];
}

export async function deleteMaterial(id: string): Promise<void> {
  await delay(300);
  const idx = MOCK_MATERIALS.findIndex((m) => m.id === id);
  if (idx !== -1) MOCK_MATERIALS.splice(idx, 1);
}
