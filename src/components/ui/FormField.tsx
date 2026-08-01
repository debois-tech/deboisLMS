import { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({ label, required, children }: FormFieldProps) {
  return (
    <div className="field">
      <label className="text-sm font-medium text-[var(--text-primary)]">
        {label}{required && ' *'}
      </label>
      {children}
    </div>
  );
}
