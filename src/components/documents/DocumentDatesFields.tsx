import { DatePicker } from '@/components/ui/DatePicker';
import { FormField } from '@/components/ui/FormField';
import type { DocumentDates } from '@/lib/utils/documents';

export const EMPTY_DATES: DocumentDates = { start: '', end: '', letter: '' };

export const datesReady = (dates: DocumentDates) => Boolean(dates.start && dates.end && dates.letter && dates.end >= dates.start);

// The three dates every generated document is made from
export function DocumentDatesFields({ value, onChange }: { value: DocumentDates; onChange: (value: DocumentDates) => void }) {
  return (
    <div className="docs-dates">
      <FormField label="Start" required>
        <DatePicker value={value.start} onChange={(start) => onChange({ ...value, start })} placeholder="Pick a date" ariaLabel="Start date" />
        <span className="field-hint">First day</span>
      </FormField>
      <FormField label="End" required>
        <DatePicker value={value.end} onChange={(end) => onChange({ ...value, end })} min={value.start || undefined} placeholder="Pick a date" ariaLabel="End date" />
        <span className="field-hint">Last day</span>
      </FormField>
      <FormField label="Letter date" required>
        <DatePicker value={value.letter} onChange={(letter) => onChange({ ...value, letter })} placeholder="Pick a date" ariaLabel="Letter date" />
        <span className="field-hint">Printed at the top</span>
      </FormField>
    </div>
  );
}
