import type { Profile, Role } from '@/lib/types';

// ── Mock current session ──────────────────────────────────
// Toggle MOCK_ROLE to test different views: 'admin' | 'student'
const MOCK_ROLE: Role = 'student';

export const MOCK_SESSION: { user: Profile } = {
  user: {
    id: 'user-001',
    full_name: MOCK_ROLE === 'admin' ? 'Deboistech Admin' : 'Alex Johnson',
    email: MOCK_ROLE === 'admin' ? 'admin@deboistech.com' : 'alex@student.com',
    role: MOCK_ROLE,
    avatar_url: undefined,
    created_at: '2026-01-01T00:00:00Z',
  },
};

// ── Simulated async helpers ───────────────────────────────
export const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export async function mockSignIn(
  email: string,
  _password: string
): Promise<Profile> {
  await delay(800);
  if (email.includes('admin')) {
    return {
      id: 'user-admin-001',
      full_name: 'Deboistech Admin',
      email,
      role: 'admin',
      created_at: '2026-01-01T00:00:00Z',
    };
  }
  return {
    id: 'user-student-001',
    full_name: 'Alex Johnson',
    email,
    role: 'student',
    created_at: '2026-02-01T00:00:00Z',
  };
}

export async function mockSignUp(
  fullName: string,
  email: string,
  _password: string
): Promise<Profile> {
  await delay(1000);
  return {
    id: `user-${Date.now()}`,
    full_name: fullName,
    email,
    role: 'student',
    created_at: new Date().toISOString(),
  };
}

export async function mockSignOut(): Promise<void> {
  await delay(300);
}

export async function mockResetPassword(_email: string): Promise<void> {
  await delay(600);
}
