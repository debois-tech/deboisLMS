import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** Goes back one page; `fallback` only when the app was opened on this page and there is nothing behind it. */
export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  const { key } = useLocation();
  // 'default' is the first history entry of the session.
  return () => (key === 'default' ? navigate(fallback, { replace: true }) : navigate(-1));
}

export function BackLink({ fallback, label = 'Back' }: { fallback: string; label?: string }) {
  const goBack = useGoBack(fallback);
  return (
    <Link
      to={fallback}
      className="detail-back-link"
      onClick={(event) => {
        // A modified click keeps its normal open-in-new-tab meaning.
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        goBack();
      }}
    >
      <ArrowLeft size={14} /> {label}
    </Link>
  );
}
