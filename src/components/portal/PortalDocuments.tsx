import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScrollText, X } from 'lucide-react';
import type { BatchStudentMapping, DocumentKind } from '@/lib/types';
import { useNow } from '@/lib/hooks/useNow';
import { toDateValue } from '@/lib/utils/date';
import { formatDate } from '@/lib/utils/format';

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;
const LABELS: Record<DocumentKind, string> = { offer_letter: 'Offer Letter', cert: 'Certificate' };

/**
 * Same shape as PortalBadgeCard: the most recently released document, if any, within the last
 * 7 days. Reuses the badge card's CSS (`.portal-badge-*`) — the layout is identical, only the
 * content differs, so a second stylesheet block would just be the same rules twice.
 */
export function PortalDocumentCard({ studentId, mapping }: { studentId: string; mapping?: BatchStudentMapping }) {
  const now = useNow();
  const today = toDateValue(new Date(now));
  const storageKey = `documents-hidden:${studentId}`;

  const [hiddenOn, setHiddenOn] = useState(() => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  });

  const recent = useMemo(() => {
    if (!mapping) return [];
    const items: { kind: DocumentKind; at: string }[] = [
      ...(mapping.offer_letter_shared && mapping.offer_letter_shared_at
        ? [{ kind: 'offer_letter' as const, at: mapping.offer_letter_shared_at }]
        : []),
      ...(mapping.cert_shared && mapping.cert_shared_at
        ? [{ kind: 'cert' as const, at: mapping.cert_shared_at }]
        : []),
    ];
    return items
      .filter((item) => now - new Date(item.at).getTime() < RECENT_MS)
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [mapping, now]);

  if (recent.length === 0 || hiddenOn === today) return null;

  const [{ kind, at }, ...others] = recent;

  const hide = () => {
    setHiddenOn(today);
    try {
      localStorage.setItem(storageKey, today);
    } catch {
      // Private mode: it still hides until the page reloads.
    }
  };

  return (
    <div className="portal-badge-card">
      <Link to="/portal/profile" className="portal-badge-open">
        <span className="portal-badge-card-art">
          <ScrollText size={26} />
        </span>
        <span className="portal-badge-copy">
          <span className="portal-badge-kicker">Document ready</span>
          <span className="portal-badge-title">{LABELS[kind]}</span>
          <span className="portal-badge-detail-line">Shared {formatDate(at)} · Tap to view</span>
          {others.length > 0 && <span className="portal-badge-more">+{others.length} more</span>}
        </span>
        <span className="portal-badge-open-arrow" aria-hidden="true">→</span>
      </Link>
      <button type="button" className="portal-badge-close" onClick={hide} aria-label="Hide until tomorrow">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
