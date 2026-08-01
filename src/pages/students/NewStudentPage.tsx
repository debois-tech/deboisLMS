import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormField } from '@/components/ui/FormField';
import { createOrReuseStudent } from '@/lib/supabase';
import { useToast } from '@/lib/context/ToastContext';

export default function NewStudentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', github_url: '', linkedin_url: '',
  });
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const student = await createOrReuseStudent(form);
      showToast('Student added successfully');
      navigate(`/students/${student.id}`);
    } catch (error: any) {
      showToast(error?.message ?? 'Failed to add student', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-section narrow">
      <PageHeader title="Add Student" />
      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Full Name" required>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. John Doe" required />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Phone">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91-9876543210" />
            </FormField>
            <FormField label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="student@email.com" />
            </FormField>
          </div>
          <FormField label="GitHub URL">
            <input value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} placeholder="https://github.com/username" />
          </FormField>
          <FormField label="LinkedIn URL">
            <input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/username" />
          </FormField>
          <div className="flex gap-3 pt-2">
            <Button className="action-button" type="submit" loading={loading}>Add Student</Button>
            <Button variant="ghost" onClick={() => navigate('/students')}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
