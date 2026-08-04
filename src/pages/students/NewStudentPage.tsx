import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormField } from '@/components/ui/FormField';
import { CredentialsModal } from '@/components/students/StudentLoginCard';
import { createOrReuseStudent, createStudentLogin } from '@/lib/supabase';
import { useToast } from '@/lib/context/ToastContext';
import type { StudentCredentials } from '@/lib/types';

export default function NewStudentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<StudentCredentials | null>(null);
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', github_url: '', linkedin_url: '',
  });
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const student = await createOrReuseStudent(form);
      setCreatedStudentId(student.id);
        showToast('Student added');

      // Reusing an existing student would otherwise rotate a password they already have —
      // leave those alone; the detail page has an explicit reset action.
      if (student.auth_user_id) {
        navigate(`/students/${student.id}`);
        return;
      }

      try {
        setCredentials(await createStudentLogin(student.id));
      } catch (loginError: any) {
        // The student record is already saved; a failed login just needs a retry from the
        // detail page, so surface it and move on rather than rolling anything back.
        showToast(loginError?.message ?? 'Student saved. Login not created.', 'warning');
        navigate(`/students/${student.id}`);
      }
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
            <FormField label="Email" required>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="student@email.com" required />
            </FormField>
          </div>
          <p className="field-hint">Used for portal login.</p>
          <FormField label="GitHub URL">
            <input value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} placeholder="https://github.com/username" />
          </FormField>
          <FormField label="LinkedIn URL">
            <input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/username" />
          </FormField>
          <div className="flex gap-3 pt-2">
            <Button className="action-button" type="submit" loading={loading}>Add Student</Button>
            <Button className='action-button-compact' variant="ghost" onClick={() => navigate('/students')}>Cancel</Button>
          </div>
        </form>
      </Card>

      <CredentialsModal
        credentials={credentials}
        onClose={() => {
          setCredentials(null);
          if (createdStudentId) navigate(`/students/${createdStudentId}`);
        }}
      />
    </div>
  );
}
