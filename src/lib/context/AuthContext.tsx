import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Profile, Role } from '@/lib/types';
import { supabase } from '@/lib/supabase/client';
import { getStudentByAuthUserId } from '@/lib/supabase';

interface AuthContextValue {
  user: Profile | null;
  setUser: (u: Profile | null) => void;
  isAdmin: boolean;
  isStudent: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  setUser: () => {},
  isAdmin: false,
  isStudent: false,
  loading: true,
});

/**
 * Role comes from app_metadata (set server-side: admin via the migration, student by the
 * create-student-login edge function) — never from user_metadata, which a user can edit
 * on themselves. Anything untagged is treated as a student, the lower-privilege default.
 */
export function roleFromUser(user: User): Role {
  return user.app_metadata?.role === 'admin' ? 'admin' : 'student';
}

export async function profileFromUser(user: User): Promise<Profile> {
  const role = roleFromUser(user);
  const base: Profile = {
    id: user.id,
    full_name: user.user_metadata?.full_name ?? (role === 'admin' ? 'Admin' : 'Student'),
    email: user.email ?? '',
    role,
    created_at: user.created_at,
  };

  if (role !== 'student') return base;

  // app_metadata carries student_id for logins created by the edge function; the lookup
  // is the fallback for any student row linked by hand.
  const metaStudentId = user.app_metadata?.student_id as string | undefined;
  const student = await getStudentByAuthUserId(user.id);

  return {
    ...base,
    full_name: student?.name ?? base.full_name,
    student_id: student?.id ?? metaStudentId,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const applySession = async (sessionUser: User | null | undefined) => {
      if (!sessionUser) {
        if (active) setUser(null);
        return;
      }
      const profile = await profileFromUser(sessionUser);
      if (active) setUser(profile);
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await applySession(session?.user);
      if (active) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.user);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAdmin: user?.role === 'admin',
        isStudent: user?.role === 'student',
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
