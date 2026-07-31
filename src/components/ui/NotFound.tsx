interface NotFoundProps {
  label: string;
}

export function NotFound({ label }: NotFoundProps) {
  return <div className="page-section text-[var(--text-muted)]">{label} not found</div>;
}
