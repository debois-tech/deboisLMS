import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { createStudent } from '@/lib/supabase';

export default function NewStudentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', github_url: '', linkedin_url: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const student = await createStudent(form);
      navigate(`/students/${student.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-section narrow">
      <PageHeader title="Add Student" />
      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Full Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. John Doe" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="field">
              <label className="text-sm font-medium text-[var(--text-primary)]">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91-9876543210" />
            </div>
            <div className="field">
              <label className="text-sm font-medium text-[var(--text-primary)]">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="student@email.com" />
            </div>
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">GitHub URL</label>
            <input value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} placeholder="https://github.com/username" />
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">LinkedIn URL</label>
            <input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/username" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="action-button" type="submit" loading={loading}>Add Student</Button>
            <Button variant="ghost" onClick={() => navigate('/students')}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
