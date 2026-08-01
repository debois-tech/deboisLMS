import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Profile } from '@/lib/types';
import { supabase } from '@/lib/supabase/client';

interface AuthContextValue {
  user: Profile | null;
  setUser: (u: Profile | null) => void;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  setUser: () => {},
  isAdmin: false,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          full_name: session.user.user_metadata?.full_name ?? 'Admin',
          email: session.user.email ?? '',
          role: 'admin',
          created_at: session.user.created_at,
        });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          full_name: session.user.user_metadata?.full_name ?? 'Admin',
          email: session.user.email ?? '',
          role: 'admin',
          created_at: session.user.created_at,
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAdmin: user?.role === 'admin',
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