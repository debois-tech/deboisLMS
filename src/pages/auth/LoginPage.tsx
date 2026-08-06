import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { FormField } from '@/components/ui/FormField';
import { useAuth } from '@/lib/context/AuthContext';
import { profileFromUser } from '@/lib/context/AuthContext';
import { useTheme } from '@/lib/context/ThemeContext';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  return <LoginPanel title="Admin login" emailPlaceholder="admin@deboistech.in" />;
}

interface LoginPanelProps {
  title: string;
  emailPlaceholder: string;
  hint?: string;
}

/** Shared by the admin and student login routes. Which dashboard you land on comes from the session role. */
export function LoginPanel({ title, emailPlaceholder, hint }: LoginPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const profile = await profileFromUser(data.user);
      setUser(profile);
      navigate(profile.role === 'admin' ? '/' : '/portal');
    }
    setLoading(false);
  };

  return (
    <AuthSurface>
      <div className="auth-panel auth-panel-compact">
        <Link to="/auth/login" className="auth-back-link">
          <ArrowLeft size={15} />
          Back
        </Link>

        <div className="auth-brand-mark">
          <img src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'} alt="Deboistech" />
        </div>
        <h1 className="auth-title">{title}</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <InlineAlert>{error}</InlineAlert>}
          <FormField label="Email">
            <div className="auth-input-wrap">
              <Mail size={17} aria-hidden="true" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={emailPlaceholder}
                autoComplete="email"
                required
              />
            </div>
          </FormField>
          <FormField label="Password">
            <div className="auth-input-wrap">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="auth-input-action"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </FormField>
          <Button type="submit" loading={loading} className="w-full">
            Log in
          </Button>
          {hint && <p className="auth-hint">{hint}</p>}
        </form>
      </div>
    </AuthSurface>
  );
}

export function AuthSurface({ children }: { children: React.ReactNode }) {
  return <main className="auth-page">{children}</main>;
}
