import { useMemo, useState } from 'react';
import { Download, ExternalLink, Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { badgeImageUrl, downloadBadgeImage, linkedInAddToProfileUrl } from '@/lib/supabase';
import type { MyBadges } from '@/lib/supabase';
import type { BatchBadge } from '@/lib/types';
import { useNow } from '@/lib/hooks/useNow';
import { useToast } from '@/lib/context/ToastContext';
import { toDateValue } from '@/lib/utils/date';
import { errorMessage } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

/** One badge up close. `earnedAt` absent means it is still locked: same art, greyed, no download or LinkedIn. */
function BadgeModal({ badge, earnedAt, onClose }: { badge: BatchBadge | null; earnedAt?: string; onClose: () => void }) {
  const { showToast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!badge) return;
    setDownloading(true);
    try {
      await downloadBadgeImage(badge);
    } catch (err) {
      showToast(errorMessage(err, 'Could not download the badge'), 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal open={badge !== null} onClose={onClose} title={badge?.name ?? ''} size="sm">
      {badge && (
        <div className="portal-badge-detail">
          <img
            src={badgeImageUrl(badge.image_path)}
            alt={badge.name}
            className={earnedAt ? undefined : 'is-locked'}
          />
          {badge.description && <p>{badge.description}</p>}
          <p className="portal-badge-when">{earnedAt ? `Earned ${formatDate(earnedAt)}` : 'Not earned yet'}</p>
          {earnedAt && (
            <div className="portal-badge-actions">
              <Button variant="secondary" className="action-button-compact" onClick={() => void download()} loading={downloading}>
                <Download size={14} /> Download
              </Button>
              <a
                href={linkedInAddToProfileUrl(badge.name, earnedAt)}
                target="_blank"
                rel="noopener noreferrer"
                className="portal-badge-linkedin"
              >
                Add to LinkedIn <ExternalLink size={14} aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Every badge of the student's batches: earned ones in colour with the date, the rest locked. */
export function PortalBadgeGrid({ badges, earned }: MyBadges) {
  const [open, setOpen] = useState<BatchBadge | null>(null);

  // Earned first, so what they have never sits behind what they do not.
  const ordered = useMemo(
    () => [...badges].sort((a, b) => Number(earned.has(b.id)) - Number(earned.has(a.id))),
    [badges, earned],
  );

  return (
    <>
      <ul className="portal-badge-grid">
        {ordered.map((badge) => {
          const held = earned.get(badge.id);
          return (
            <li key={badge.id}>
              <button
                type="button"
                className={`portal-badge-tile${held ? '' : ' is-locked'}`}
                onClick={() => setOpen(badge)}
              >
                <img src={badgeImageUrl(badge.image_path)} alt="" />
                <span className="portal-badge-name">{badge.name}</span>
                <span className="portal-badge-meta">
                  {held ? formatDate(held.issued_at) : <><Lock size={12} aria-hidden="true" /> Locked</>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <BadgeModal badge={open} earnedAt={open ? earned.get(open.id)?.issued_at : undefined} onClose={() => setOpen(null)} />
    </>
  );
}

/**
 * Top of Home: the newest badge from the last 7 days. The X hides it for the rest of today
 * on this device and it is back tomorrow, until the 7 days run out.
 */
export function PortalBadgeCard({ studentId, badges, earned }: MyBadges & { studentId: string }) {
  const now = useNow();
  const today = toDateValue(new Date(now));
  const storageKey = `badges-hidden:${studentId}`;

  const [hiddenOn, setHiddenOn] = useState(() => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  });
  const [open, setOpen] = useState(false);

  const recent = useMemo(() => {
    const byId = new Map(badges.map((badge) => [badge.id, badge]));
    return [...earned.values()]
      .filter((held) => now - new Date(held.issued_at).getTime() < RECENT_MS && byId.has(held.badge_id))
      .sort((a, b) => b.issued_at.localeCompare(a.issued_at))
      .map((held) => ({ held, badge: byId.get(held.badge_id)! }));
  }, [badges, earned, now]);

  if (recent.length === 0 || hiddenOn === today) return null;

  const [{ held, badge }, ...others] = recent;

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
      <button type="button" className="portal-badge-open" onClick={() => setOpen(true)}>
        <img src={badgeImageUrl(badge.image_path)} alt="" />
        <span className="portal-badge-copy">
          <span className="portal-badge-title">You earned {badge.name} recently!</span>
          <span className="portal-badge-detail-line">Share it with your friends!</span>
          {others.length > 0 && <span className="portal-badge-more">+{others.length} more</span>}
        </span>
      </button>
      <button type="button" className="portal-badge-close" onClick={hide} aria-label="Hide until tomorrow">
        <X size={16} aria-hidden="true" />
      </button>
      <BadgeModal badge={open ? badge : null} earnedAt={held.issued_at} onClose={() => setOpen(false)} />
    </div>
  );
}
