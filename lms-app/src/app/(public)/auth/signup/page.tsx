'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/context/ToastContext';
import { useAuth } from '@/lib/context/AuthContext';
import { mockSignUp } from '@/lib/mock/auth';

export default function SignupPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { showToast('Please fill in all fields.', 'error'); return; }
    if (form.password !== form.confirm) { showToast('Passwords do not match.', 'error'); return; }
    if (form.password.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
    setLoading(true);
    try {
      const user = await mockSignUp(form.name, form.email, form.password);
      setUser(user);
      showToast('Account created! Welcome to Deboistech LMS.', 'success');
      router.push('/dashboard');
    } catch {
      showToast('Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-lg mb-6">
            <span className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white text-xs font-black">D</span>
            <span className="gradient-text">Deboistech LMS</span>
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Create your account</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Already have one?{' '}
            <Link href="/auth/login" className="text-[var(--primary)] hover:underline font-medium">Sign in</Link>
          </p>
        </div>

        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[20px] p-7 shadow-[var(--shadow-md)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { field: 'name',     label: 'Full name',    type: 'text',     icon: User,  placeholder: 'Alex Johnson' },
              { field: 'email',    label: 'Email address', type: 'email',   icon: Mail,  placeholder: 'you@example.com' },
            ].map(({ field, label, type, icon: Icon, placeholder }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">{label}</label>
                <div className="relative">
                  <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type={type}
                    value={form[field as keyof typeof form]}
                    onChange={update(field)}
                    placeholder={placeholder}
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                  />
                </div>
              </div>
            ))}

            {['password', 'confirm'].map((field, i) => (
              <div key={field}>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  {i === 0 ? 'Password' : 'Confirm password'}
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form[field as keyof typeof form]}
                    onChange={update(field)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
                  />
                  {i === 0 && (
                    <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <Button type="submit" loading={loading} className="w-full mt-2">
              Create Account
            </Button>
          </form>

          <p className="text-[10px] text-[var(--text-muted)] text-center mt-4">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
