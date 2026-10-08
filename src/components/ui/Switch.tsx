export function Switch({ checked, onChange, label, danger, disabled }: {
  checked: boolean;
  onChange: () => void;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={`settings-switch${danger ? ' is-danger' : ''}`}
    />
  );
}
