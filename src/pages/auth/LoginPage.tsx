import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { FormField } from '@/components/ui/FormField';
import { useAuth } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      setUser({
        id: data.user.id,
        full_name: data.user.user_metadata?.full_name ?? 'Admin',
        email: data.user.email ?? '',
        role: 'admin',
        created_at: data.user.created_at,
      });
      navigate('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-4">
      <Card padding="lg" className="w-full max-w-md">
        <div className="text-center mb-6">
          <img src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'} alt="Deboistech" className="h-14 w-auto mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Deboistech ERP</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Admin dashboard login</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <InlineAlert>{error}</InlineAlert>}
          <FormField label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@deboistech.com"
              required
            />
          </FormField>
          <FormField label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </FormField>
          <Button type="submit" loading={loading} className="w-full">
            Sign In
          </Button>
        </form>
      </Card>
    </div>
  );
}