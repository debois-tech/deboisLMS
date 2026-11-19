import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  placeholder?: string;
  /** `current-password` for a sign-in, the default is for choosing a new one. */
  autoComplete?: 'current-password' | 'new-password';
  required?: boolean;
}

/** Every password field: a lock icon and a show/hide eye. */
export function PasswordInput({ value, onChange, invalid, placeholder, autoComplete = 'new-password', required }: PasswordInputProps) {
  const [shown, setShown] = useState(false);
  return (
    <div className="auth-input-wrap">
      <LockKeyhole size={17} aria-hidden="true" />
      <input
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={invalid}
      />
      <button
        type="button"
        className="auth-input-action"
        onClick={() => setShown((visible) => !visible)}
        aria-label={shown ? 'Hide password' : 'Show password'}
      >
        {shown ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
