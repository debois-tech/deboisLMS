import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { NotFound } from '@/components/ui/NotFound';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormField } from '@/components/ui/FormField';
import { getStudentById, updateStudent } from '@/lib/supabase';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { useToast } from '@/lib/context/ToastContext';
import type { Student } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

/** Only the three fields that go stale are editable; the rest are facts of record. */
export default function EditStudentPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;
    const record = await getStudentById(studentId);
    if (!record) return;
    setStudent(record);
    setForm({ name: record.name, phone: record.phone ?? '', email: record.email ?? '' });
  });

  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: event.target.value });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!student) return;
    setSaving(true);
    try {
      await updateStudent(student.id, {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      });
      showToast('Student updated');
      navigate(`/students/${student.id}`);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to save the student'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!student) return <NotFound label="Student" />;

  // Shown, not editable. Empty ones are left out.
  const locked = [
    { label: 'Student ID', value: student.student_code },
    { label: 'Date of Birth', value: student.date_of_birth ? formatDate(student.date_of_birth) : '' },
    { label: 'Gender', value: student.gender },
    { label: 'College', value: student.college },
    { label: 'Course', value: student.course },
    { label: 'Branch', value: student.branch },
    { label: 'Current Year', value: student.current_year },
    { label: 'Graduation Year', value: student.graduation_year ? String(student.graduation_year) : '' },
    { label: 'GitHub', value: student.github_url },
    { label: 'LinkedIn', value: student.linkedin_url },
  ].filter((fact) => fact.value);

  return (
    <div className="page-section narrow">
      <PageHeader title="Edit Student" />

      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Full Name" required>
            <input value={form.name} onChange={set('name')} required />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="WhatsApp Number">
              <input value={form.phone} onChange={set('phone')} />
            </FormField>
            <FormField label="Email" required>
              <input type="email" value={form.email} onChange={set('email')} required />
            </FormField>
          </div>
          <p className="field-hint">
            The email is the portal login. Changing it here does not change the login —
            reset the portal login from the student's page afterwards.
          </p>

          <div className="flex gap-3 pt-2">
            <Button className="action-button" type="submit" loading={saving} disabled={!form.name.trim()}>
              Save Changes
            </Button>
            <Button
              className="action-button-compact"
              variant="ghost"
              onClick={() => navigate(`/students/${student.id}`)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      {locked.length > 0 && (
        <Card padding="lg">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Lock size={14} className="shrink-0 text-[var(--text-muted)]" />
            Fixed on this record
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {locked.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="text-xs text-[var(--text-muted)]">{fact.label}</dt>
                <dd className="mt-1 text-sm font-semibold text-[var(--text-primary)] break-words">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}
