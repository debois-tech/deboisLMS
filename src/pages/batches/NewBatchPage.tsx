import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { FormField } from '@/components/ui/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { createBatch, getBatchPrograms, saveBatchProgram, PROGRAM_CODE_PATTERN } from '@/lib/supabase';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';
import type { BatchProgramOption } from '@/lib/types';

/** Sentinel for the "not in the list yet" row, which reveals the two fields below it. */
const NEW_PROGRAM = '__new__';

export default function NewBatchPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [programs, setPrograms] = useState<BatchProgramOption[]>([]);
  const [program, setProgram] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [baseFee, setBaseFee] = useState('');
  const [form, setForm] = useState({
    name: '',
    // Status is not picked by hand — it follows the start date.
    status: 'upcoming' as const,
    start_date: '',
    batch_code: '',
  });
  const { showToast } = useToast();

  useEffect(() => {
    void getBatchPrograms().then(setPrograms).catch(() => setPrograms([]));
  }, []);

  const addingProgram = program === NEW_PROGRAM;
  const codeReady = PROGRAM_CODE_PATTERN.test(newCode.trim().toUpperCase());
  const feeReady = baseFee.trim() !== '' && Number(baseFee) >= 0;
  const incomplete =
    !form.name.trim() || !program || !feeReady || (addingProgram && (!codeReady || !newName.trim()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (incomplete) return;
    setLoading(true);
    try {
      // The programme is written first: a batch pointing at a code that does not
      // exist yet is rejected by the foreign key, so order matters here.
      let code = program as string;
      if (addingProgram) {
        const saved = await saveBatchProgram(newCode, newName, programs.length + 1);
        code = saved.code;
        setPrograms([...programs, saved]);
      }

      const batch = await createBatch({ ...form, program: code, base_fee: Number(baseFee) });
      showToast('Batch created');
      navigate(`/batches/${batch.id}`);
    } catch (error) {
      showToast(errorMessage(error, 'Failed to create batch'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-section narrow">
      <PageHeader title="New Batch" />

      <Card padding="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Batch Name" required>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </FormField>

          <FormField label="Programme" required>
            <SearchSelect
              options={[
                ...programs.map((option) => ({ value: option.code, label: `${option.name} (${option.code})` })),
                { value: NEW_PROGRAM, label: 'Add a new programme' },
              ]}
              value={program}
              onChange={setProgram}
              placeholder="Select programme"
              searchPlaceholder="Search programmes"
              emptyText="No programmes yet"
            />
          </FormField>

          {addingProgram && (
            <div className="grid grid-cols-[8rem_1fr] gap-4">
              <FormField label="Abbreviation" required>
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  autoCapitalize="characters"
                  spellCheck={false}
                  required
                />
              </FormField>
              <FormField label="Programme Name" required>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </FormField>
              {/* Only when the code is wrong. The valid case says nothing. */}
              {newCode && !codeReady && (
                <p className="field-hint col-span-2">Use 2 to 6 capital letters.</p>
              )}
            </div>
          )}

          <FormField label="Base Fee" required>
            <input
              type="number"
              min="0"
              value={baseFee}
              onChange={(e) => setBaseFee(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Batch Code">
            <input
              value={form.batch_code}
              onChange={(e) => setForm({ ...form, batch_code: e.target.value })}
              autoCapitalize="characters"
              spellCheck={false}
            />
          </FormField>

          <FormField label="Start Date">
            <DatePicker
              value={form.start_date}
              onChange={(start_date) => setForm({ ...form, start_date })}
              placeholder="Pick a start date"
              ariaLabel="Start date"
            />
          </FormField>

          <div className="flex gap-3 pt-2">
            <Button className="action-button-compact" type="submit" loading={loading} disabled={incomplete}>
              Create Batch
            </Button>
            <Button className="action-button-compact" variant="ghost" onClick={() => navigate('/batches')}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
