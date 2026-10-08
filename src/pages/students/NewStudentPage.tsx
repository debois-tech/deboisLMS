import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useGoBack } from '@/components/ui/BackLink';
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
import { EarlierWorkTick } from '@/components/batches/EarlierWorkTick';
import { CredentialsModal } from '@/components/students/StudentLoginCard';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { createStudentInBatch, createStudentLogin, getBatches } from '@/lib/supabase';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { useToast } from '@/lib/context/ToastContext';
import type { Batch, StudentCredentials } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';
import { feeFromDiscountValue, formatCurrency } from '@/lib/utils/format';

export default function NewStudentPage() {
  const navigate = useNavigate();
  const goBack = useGoBack('/students');
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<StudentCredentials | null>(null);
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  // Discount and Fee are one number seen two ways: typing either fills the other.
  // `feeText` is null until the Fee field is typed in, then the fee is what was typed.
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');
  const [feeText, setFeeText] = useState<string | null>(null);
  const [countEarlier, setCountEarlier] = useState(true);
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

  const batch = batches.find((option) => option.id === batchId);
  const baseFee = batch?.base_fee ?? null;
  const typedFee = feeText ? Number(feeText) : null;
  const payable = baseFee === null ? null : typedFee ?? feeFromDiscountValue(baseFee, Number(discount) || 0, discountType);
  const feeFlag = baseFee !== null && typedFee !== null && typedFee > baseFee ? `Above base ${formatCurrency(baseFee)}` : '';

  const handleFee = (value: string) => {
    setFeeText(value);
    // Above base is flagged and blocked, so the discount is only filled from a fee that can be saved.
    if (baseFee !== null && value && Number(value) <= baseFee) {
      setDiscountType('amount');
      setDiscount(String(baseFee - Number(value)));
    }
  };

  const handleDiscount = (value: string, type = discountType) => {
    setDiscount(value);
    setDiscountType(type);
    setFeeText(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A student with no batch sees nothing in the portal and belongs to no roster.
    if (!batchId) {
      showToast('Select a batch for this student', 'error');
      return;
    }
    // DatePicker is not a native input, so required has to be checked here.
    if (!form.date_of_birth) {
      showToast('Pick a date of birth', 'error');
      return;
    }
    if (payable === null) {
      showToast(`${batch?.name ?? 'This batch'} has no base fee. Set one on the batch first.`, 'error');
      return;
    }
    setLoading(true);
    try {
      // Blank strings are left out, and graduation_year is an int column that cannot take ''
      const { graduation_year, ...text } = form;
      const { student, earlier } = await createStudentInBatch(
        {
          ...Object.fromEntries(Object.entries(text).filter(([, value]) => value !== '')),
          ...(graduation_year ? { graduation_year: Number(graduation_year) } : {}),
        } as Parameters<typeof createStudentInBatch>[0],
        batchId,
        payable,
        { type: discountType, value: Number(discount) || 0 },
        countEarlier,
      );
      setCreatedStudentId(student.id);
      showToast('Student added');
      if (earlier) showToast(`An earlier account (${earlier.student_code}) was left as it was`, 'warning');

      try {
        setCredentials(await createStudentLogin(student.id));
      } catch (loginError) {
        // The record is saved; a failed login just needs a retry from the detail page.
        showToast(errorMessage(loginError, 'Student saved. Login not created.'), 'warning');
        navigate(`/students/${student.id}`, { replace: true });
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
            <input value={form.name} onChange={set('name')} required />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_8rem_9rem]">
            <FormField label="Batch" required>
              <BatchSelect batches={batches} value={batchId} onChange={(id) => { setBatchId(id); setFeeText(null); }} />
            </FormField>
            <FormField label="Discount">
              <div className="relative">
                <input
                  className="pr-20"
                  type="number"
                  min="0"
                  max={discountType === 'percentage' ? 100 : undefined}
                  value={discount}
                  onChange={(e) => handleDiscount(e.target.value)}
                  aria-label={discountType === 'percentage' ? 'Discount percentage' : 'Discount amount'}
                />
                <span aria-hidden className="absolute right-[4.5rem] top-1 bottom-1 w-[2px] bg-[var(--border)]" />
                <div className="absolute right-1 top-1 bottom-1 flex rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] p-0.5">
                  <button type="button" onClick={() => handleDiscount(discount, 'percentage')} aria-pressed={discountType === 'percentage'} className={`min-w-8 rounded-[var(--radius-sm)] px-2 text-xs font-semibold transition-colors ${discountType === 'percentage' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)]'}`}>%</button>
                  <button type="button" onClick={() => handleDiscount(discount, 'amount')} aria-pressed={discountType === 'amount'} className={`min-w-8 rounded-[var(--radius-sm)] px-2 text-xs font-semibold transition-colors ${discountType === 'amount' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)]'}`}>₹</button>
                </div>
              </div>
            </FormField>
            <FormField label="Fee">
              <input
                type="number"
                min="0"
                max={baseFee ?? undefined}
                value={feeText ?? (payable === null ? '' : String(payable))}
                onChange={(e) => handleFee(e.target.value)}
                disabled={baseFee === null}
                aria-invalid={Boolean(feeFlag)}
                aria-label="Fee"
              />
              {feeFlag && <p className="field-flag">{feeFlag}</p>}
            </FormField>
          </div>

          {batchId && baseFee === null && (
            <InlineAlert>
              {batch?.name ?? 'This batch'} has no base fee, so a discount has nothing to come off.
              Set one on the batch, then add the student.
            </InlineAlert>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Date of Birth" required>
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
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Mobile Number" required>
              <input value={form.phone} onChange={set('phone')} required />
            </FormField>
            <FormField label="Email" required>
              <input type="email" value={form.email} onChange={set('email')} required />
            </FormField>
          </div>
          <FormField label="College / University">
            <input value={form.college} onChange={set('college')} />
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Course / Degree">
              <input value={form.course} onChange={set('course')} />
            </FormField>
            <FormField label="Branch / Specialization">
              <input value={form.branch} onChange={set('branch')} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Current Year">
              <input value={form.current_year} onChange={set('current_year')} />
            </FormField>
            <FormField label="Graduation Year">
              <input type="number" min="1900" max="2200" value={form.graduation_year} onChange={set('graduation_year')} />
            </FormField>
          </div>
          <FormField label="GitHub URL"><input value={form.github_url} onChange={set('github_url')} /></FormField>
          <FormField label="LinkedIn URL"><input value={form.linkedin_url} onChange={set('linkedin_url')} /></FormField>
          <EarlierWorkTick batch={batch} checked={countEarlier} onChange={setCountEarlier} />
          <div className="flex gap-3 pt-2">
            <Button
              className="action-button"
              type="submit"
              loading={loading}
              disabled={(Boolean(batchId) && payable === null) || Boolean(feeFlag)}
            >
              Add Student
            </Button>
            <Button className='action-button-compact' variant="ghost" onClick={goBack}>Cancel</Button>
          </div>
        </form>
      </Card>

      <CredentialsModal
        credentials={credentials}
        studentId={createdStudentId}
        onClose={() => {
          setCredentials(null);
          if (createdStudentId) navigate(`/students/${createdStudentId}`, { replace: true });
        }}
      />
    </div>
  );
}
