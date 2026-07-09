'use client';

import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { useState } from 'react';
import { Camera, Mail, User } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState(user?.full_name ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    if (user) setUser({ ...user, full_name: name });
    showToast('Profile updated!', 'success');
    setSaving(false);
  };

  const initials = user?.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() ?? '?';

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">My Profile</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Manage your account details.</p>
      </div>

      <Card>
        {/* Avatar */}
        <div className="flex items-center gap-5 mb-6 pb-6 border-b border-[var(--border)]">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white text-2xl font-black">
              {initials}
            </div>
            <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <Camera size={13} />
            </button>
          </div>
          <div>
            <h2 className="font-semibold text-[var(--text-primary)] text-lg">{user?.full_name}</h2>
            <p className="text-sm text-[var(--text-muted)]">{user?.email}</p>
            <div className="mt-1.5">
              <Badge variant={user?.role === 'admin' ? 'info' : 'success'} dot>
                {user?.role === 'admin' ? 'Administrator' : 'Student'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Edit form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Full Name</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email Address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={user?.email}
                disabled
                className="w-full pl-9 pr-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[10px] text-sm text-[var(--text-muted)] cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">Email cannot be changed here.</p>
          </div>
          <Button type="submit" loading={saving}>Save Changes</Button>
        </form>
      </Card>
    </div>
  );
}
