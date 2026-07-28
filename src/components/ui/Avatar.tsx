import { clsx } from 'clsx';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

export function Avatar({ name, size = 'md' }: AvatarProps) {
  return (
    <div
      className={clsx(
        'rounded-full bg-[var(--primary)]/10 flex items-center justify-center font-bold text-[var(--primary)]',
        sizeClasses[size],
      )}
    >
      {getInitials(name)}
    </div>
  );
}
