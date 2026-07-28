import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { createTutor } from '@/lib/supabase';

export default function NewTutorPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createTutor(form);
      navigate('/tutors');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Add Tutor</h1>
        <p className="text-sm text-[var(--text-muted)]">Register a new tutor</p>
      </div>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Full Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label className="text-sm font-medium text-[var(--text-primary)]">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label className="text-sm font-medium text-[var(--text-primary)]">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading}>Add Tutor</Button>
            <Button variant="ghost" onClick={() => navigate('/tutors')}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}