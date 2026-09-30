import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { NotFound } from '@/components/ui/NotFound';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormField } from '@/components/ui/FormField';
import { DatePicker } from '@/components/ui/DatePicker';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { getStudentById, updateStudent } from '@/lib/supabase';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { useToast } from '@/lib/context/ToastContext';
import type { InternshipRole, Student } from '@/lib/types';
import { INTERNSHIP_ROLE_OPTIONS } from '@/lib/utils/studentImport';
import { errorMessage } from '@/lib/utils/errors';

type EditableStudent = Pick<Student, 'name' | 'phone' | 'date_of_birth' | 'college' | 'course' | 'branch' | 'current_year' | 'graduation_year' | 'github_url' | 'linkedin_url' | 'internship_role' | 'internship_start_date' | 'internship_end_date'>;

export default function EditStudentPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [form, setForm] = useState<EditableStudent>({ name: '', phone: '', date_of_birth: '', college: '', course: '', branch: '', current_year: '', graduation_year: undefined, github_url: '', linkedin_url: '', internship_role: null, internship_start_date: '', internship_end_date: '' });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;
    const record = await getStudentById(studentId);
    if (!record) return;
    setStudent(record);
    setForm({ name: record.name, phone: record.phone, date_of_birth: record.date_of_birth ?? '', college: record.college ?? '', course: record.course ?? '', branch: record.branch ?? '', current_year: record.current_year ?? '', graduation_year: record.graduation_year, github_url: record.github_url ?? '', linkedin_url: record.linkedin_url ?? '', internship_role: record.internship_role ?? null, internship_start_date: record.internship_start_date ?? '', internship_end_date: record.internship_end_date ?? '' });
  });

  const set = (field: keyof EditableStudent) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: field === 'graduation_year' ? (event.target.value ? Number(event.target.value) : undefined) : event.target.value });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!student) return;
    // DatePicker is not a native input, so required has to be checked here.
    if (!form.date_of_birth) {
      showToast('Pick a date of birth', 'error');
      return;
    }
    if (form.internship_start_date && form.internship_end_date && form.internship_end_date < form.internship_start_date) {
      showToast('The internship cannot end before it starts', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateStudent(student.id, {
        ...form,
        name: form.name.trim(),
        phone: form.phone.trim(),
        graduation_year: form.graduation_year || undefined,
        // A cleared date is null in the database, not an empty string.
        internship_start_date: form.internship_start_date || null,
        internship_end_date: form.internship_end_date || null,
      });
      showToast('Student updated');
      navigate(`/students/${student.id}`);
    } catch (err) {
      showToast(errorMessage(err, 'Failed to save the student'), 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!student) return <NotFound label="Student" />;

  return (
    <div className="page-section narrow">
      <PageHeader title="Edit Student" />
      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Full Name" required><input value={form.name} onChange={set('name')} required /></FormField>
            <FormField label="Mobile Number" required><input value={form.phone} onChange={set('phone')} required /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date of Birth" required><DatePicker value={form.date_of_birth ?? ''} onChange={(date_of_birth) => setForm({ ...form, date_of_birth })} placeholder="Pick a date" ariaLabel="Date of birth" /></FormField>
            <FormField label="College / University"><input value={form.college ?? ''} onChange={set('college')} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Course / Degree"><input value={form.course ?? ''} onChange={set('course')} /></FormField>
            <FormField label="Branch / Specialization"><input value={form.branch ?? ''} onChange={set('branch')} /></FormField>
          </div>
          <FormField label="Internship Role">
            <SearchSelect
              showSearch={false}
              options={INTERNSHIP_ROLE_OPTIONS}
              value={form.internship_role ?? null}
              onChange={(value) => setForm({ ...form, internship_role: value as InternshipRole })}
              placeholder="Select a role"
              searchPlaceholder="Search"
              emptyText="No match"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Internship Start">
              <DatePicker value={form.internship_start_date ?? ''} onChange={(internship_start_date) => setForm({ ...form, internship_start_date })} placeholder="Pick a date" ariaLabel="Internship start date" />
            </FormField>
            <FormField label="Internship End">
              <DatePicker value={form.internship_end_date ?? ''} onChange={(internship_end_date) => setForm({ ...form, internship_end_date })} min={form.internship_start_date || undefined} placeholder="Pick a date" ariaLabel="Internship end date" />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Current Year"><input value={form.current_year ?? ''} onChange={set('current_year')} /></FormField>
            <FormField label="Graduation Year"><input type="number" min="1900" max="2200" value={form.graduation_year ?? ''} onChange={set('graduation_year')} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="GitHub URL"><input value={form.github_url ?? ''} onChange={set('github_url')} /></FormField>
            <FormField label="LinkedIn URL"><input value={form.linkedin_url ?? ''} onChange={set('linkedin_url')} /></FormField>
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="action-button" type="submit" loading={saving}>Save Changes</Button>
            <Button className="action-button-compact" variant="ghost" onClick={() => navigate(`/students/${student.id}`)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
