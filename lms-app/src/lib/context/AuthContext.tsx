'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import type { Profile } from '@/lib/types';
import { MOCK_SESSION } from '@/lib/mock/auth';

interface AuthContextValue {
  user: Profile | null;
  setUser: (u: Profile | null) => void;
  isAdmin: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  setUser: () => {},
  isAdmin: false,
  isStudent: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start with mock session — swap with real Supabase session later
  const [user, setUser] = useState<Profile | null>(MOCK_SESSION.user);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAdmin: user?.role === 'admin',
        isStudent: user?.role === 'student',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
