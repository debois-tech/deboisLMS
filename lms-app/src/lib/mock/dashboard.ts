import type { AdminStats, ActivityItem } from '@/lib/types';
import { delay } from './auth';

export async function getAdminStats(): Promise<AdminStats> {
  await delay(300);
  return {
    total_classes: 4,
    total_students: 85,
    pending_grading: 3,
  };
}

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 'a-001', text: 'Alex Johnson joined Introduction to Web Development', timestamp: '2026-07-09T13:00:00Z', type: 'enrollment' },
  { id: 'a-002', text: 'Priya Sharma submitted "DOM Manipulation Exercise"', timestamp: '2026-07-09T09:00:00Z', type: 'submission' },
  { id: 'a-003', text: 'New material posted: "Week 1 Lecture Notes"', timestamp: '2026-07-08T14:30:00Z', type: 'material' },
  { id: 'a-004', text: 'Marcus Williams took "HTML & CSS Fundamentals Quiz"', timestamp: '2026-07-08T11:00:00Z', type: 'test' },
  { id: 'a-005', text: 'Sofia Chen joined Python for Data Science', timestamp: '2026-07-07T16:00:00Z', type: 'enrollment' },
  { id: 'a-006', text: 'James Okafor submitted "Build a Portfolio Website"', timestamp: '2026-07-07T20:00:00Z', type: 'submission' },
];

export async function getRecentActivity(): Promise<ActivityItem[]> {
  await delay(300);
  return MOCK_ACTIVITY;
}
