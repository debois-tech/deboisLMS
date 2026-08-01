import { Link } from 'react-router-dom';

interface StudentLinkProps {
  studentId: string;
  name: string;
  className?: string;
}

export function StudentLink({ studentId, name, className }: StudentLinkProps) {
  return (
    <Link to={`/students/${studentId}`} className={className ?? 'text-[var(--text-primary)] hover:underline'}>
      {name}
    </Link>
  );
}
