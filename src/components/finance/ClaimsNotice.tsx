import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Wallet } from 'lucide-react';
import { CLAIMS_CHANGED, getAllPendingClaims, type PendingClaimRow } from '@/lib/supabase/queries/paymentClaims';
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency } from '@/lib/utils/format';

const SHOWN = 3;
const POLL_MS = 60_000;

/** Stays in the bottom-right until every student claim is verified or dismissed. Each row opens that student. */
export function ClaimsNotice() {
  const { isAdmin } = useAuth();
  const [claims, setClaims] = useState<PendingClaimRow[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    let live = true;
    const load = () => getAllPendingClaims().then((c) => { if (live) setClaims(c); }).catch(console.error);
    load();
    const timer = setInterval(load, POLL_MS);
    window.addEventListener(CLAIMS_CHANGED, load);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener(CLAIMS_CHANGED, load);
    };
  }, [isAdmin]);

  if (!isAdmin || claims.length === 0) return null;

  return (
    <div className="toast claims-notice" role="status">
      <span className="toast-icon is-warning">
        <Wallet size={16} aria-hidden="true" />
      </span>
      <div className="claims-notice-body">
        <p className="claims-notice-title">
          {claims.length} payment {claims.length === 1 ? 'claim' : 'claims'} to verify
        </p>
        <ul className="claims-notice-list">
          {claims.slice(0, SHOWN).map((claim) => (
            <li key={claim.id}>
              <Link to={`/students/${claim.student_id}`} className="claims-notice-row">
                <span className="claims-notice-name">{claim.student?.name ?? 'Student'}</span>
                <span className="claims-notice-amount">{formatCurrency(Number(claim.amount))}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        {claims.length > SHOWN && <p className="claims-notice-more">+{claims.length - SHOWN} more</p>}
      </div>
    </div>
  );
}
