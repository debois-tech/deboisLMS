import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormField } from '@/components/ui/FormField';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { GENDER_OPTIONS } from '@/lib/utils/studentImport';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { CredentialsModal } from '@/components/students/StudentLoginCard';
import { addStudentToBatch, createOrReuseStudent, createStudentLogin, getBatches } from '@/lib/supabase';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { useToast } from '@/lib/context/ToastContext';
import type { Batch, StudentCredentials } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';

export default function NewStudentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<StudentCredentials | null>(null);
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [fee, setFee] = useState('');
  // Mirrors STUDENT_IMPORT_FIELDS, so a student typed in here carries the same
  // profile as one that arrived on a CSV.
  const [form, setForm] = useState({
    name: '', phone: '', email: '', date_of_birth: '', gender: '',
    college: '', course: '', branch: '', current_year: '', graduation_year: '',
    github_url: '', linkedin_url: '',
  });

  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: event.target.value });
  const { showToast } = useToast();

  const { loading: loadingBatches, error, retry } = useInitialLoad(async () => {
    setBatches(await getBatches());
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A student with no batch sees nothing in the portal and belongs to no roster.
    if (!batchId) {
      showToast('Select a batch for this student', 'error');
      return;
    }
    setLoading(true);
    try {
      // Blank strings would overwrite a reused student's real values with empties,
      // and graduation_year is an int column that cannot take ''.
      const { graduation_year, ...text } = form;
      const student = await createOrReuseStudent({
        ...Object.fromEntries(Object.entries(text).filter(([, value]) => value !== '')),
        ...(graduation_year ? { graduation_year: Number(graduation_year) } : {}),
      } as Parameters<typeof createOrReuseStudent>[0]);
      setCreatedStudentId(student.id);
      // An existing student already on this batch is the goal, not an error — the
      // unique mapping throws, and the login below should still run.
      await addStudentToBatch(student.id, batchId, Number(fee) || 0).catch(() => undefined);
      showToast('Student added');

      // Reusing an existing student would rotate a password they already have — skip those.
      if (student.auth_user_id) {
        navigate(`/students/${student.id}`);
        return;
      }

      try {
        setCredentials(await createStudentLogin(student.id));
      } catch (loginError) {
        // The record is saved; a failed login just needs a retry from the detail page.
        showToast(errorMessage(loginError, 'Student saved. Login not created.'), 'warning');
        navigate(`/students/${student.id}`);
      }
    } catch (error) {
      showToast(errorMessage(error, 'Failed to add student'), 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loadingBatches) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  // No batch means nothing to enrol into, so the form is not offered at all.
  if (batches.length === 0) {
    return (
      <div className="page-section narrow">
        <PageHeader title="Add Student" />
        <EmptyState
          icon={<Users size={32} />}
          title="Create a batch first"
          action={{ label: 'New Batch', onClick: () => navigate('/batches/new') }}
        />
      </div>
    );
  }

  return (
    <div className="page-section narrow">
      <PageHeader title="Add Student" />
      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Full Name" required>
            <input value={form.name} onChange={set('name')} placeholder="e.g. John Doe" required />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Batch" required>
              <BatchSelect batches={batches} value={batchId} onChange={setBatchId} />
            </FormField>
            <FormField label="Total Fee" required>
              <input type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="e.g. 15000" required />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date of Birth">
              <DatePicker
                value={form.date_of_birth}
                onChange={(date_of_birth) => setForm({ ...form, date_of_birth })}
                placeholder="Pick a date"
                ariaLabel="Date of birth"
              />
            </FormField>
            <FormField label="Gender">
              <SearchSelect
                options={GENDER_OPTIONS.map((option) => ({ value: option, label: option }))}
                value={form.gender || null}
                onChange={(gender) => setForm({ ...form, gender })}
                placeholder="Select gender"
                searchPlaceholder="Search"
                emptyText="No match"
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="WhatsApp Number">
              <input value={form.phone} onChange={set('phone')} placeholder="+91-9876543210" />
            </FormField>
            <FormField label="Email" required>
              <input type="email" value={form.email} onChange={set('email')} placeholder="student@email.com" required />
            </FormField>
          </div>
          <p className="field-hint">Used for portal login.</p>
          <FormField label="College / University">
            <input value={form.college} onChange={set('college')} placeholder="e.g. Pune Institute of Technology" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Course / Degree">
              <input value={form.course} onChange={set('course')} placeholder="e.g. B.Tech" />
            </FormField>
            <FormField label="Branch / Specialization">
              <input value={form.branch} onChange={set('branch')} placeholder="e.g. Computer Science" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Current Year">
              <input value={form.current_year} onChange={set('current_year')} placeholder="e.g. 3rd" />
            </FormField>
            <FormField label="Graduation Year">
              <input type="number" min="1900" max="2200" value={form.graduation_year} onChange={set('graduation_year')} placeholder="e.g. 2027" />
            </FormField>
          </div>
          <FormField label="GitHub URL">
            <input value={form.github_url} onChange={set('github_url')} placeholder="https://github.com/username" />
          </FormField>
          <FormField label="LinkedIn URL">
            <input value={form.linkedin_url} onChange={set('linkedin_url')} placeholder="https://linkedin.com/in/username" />
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
