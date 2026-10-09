import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from '@/components/ui/Badge';
import { OPEN_BELL, useNotifications } from '@/components/notifications/NotificationsProvider';
import type { Notice } from '@/lib/hooks/useNotices';

// Never more than this many cards at once; the rest wait behind a "+N more" chip
const MAX_CARDS = 3;
const EXIT_MS = 180;

// What was on the notice when it was collapsed or closed: it stays that way until something new appears
const signature = (notice: Notice) => `${notice.count}:${notice.ids?.join(',') ?? notice.rows.map((row) => row.key).join(',')}`;
type Mark = 'notice' | 'notice-hidden';

function isMarked(notice: Notice, mark: Mark) {
  try {
    return localStorage.getItem(`${mark}:${notice.id}`) === signature(notice);
  } catch {
    return false;
  }
}

function setMark(notice: Notice, mark: Mark, on: boolean) {
  try {
    if (on) localStorage.setItem(`${mark}:${notice.id}`, signature(notice));
    else localStorage.removeItem(`${mark}:${notice.id}`);
  } catch {
    // Storage blocked: the notice just stays open
  }
}

// Bottom-right cards: work waiting collapses, everything else closes; click a card to go where it leads
export function NotificationStack() {
  const { notices, open } = useNotifications();
  const [leaving, setLeaving] = useState<string[]>([]);
  const [, refresh] = useState(0);

  // Plays the exit, then does the thing
  const withExit = (notice: Notice, act: () => void) => {
    setLeaving((ids) => [...ids, notice.id]);
    window.setTimeout(() => {
      act();
      setLeaving((ids) => ids.filter((id) => id !== notice.id));
      refresh((count) => count + 1);
    }, EXIT_MS);
  };

  // Read ones and closed ones have no card; a collapsed one is a chip
  const waiting = notices.filter((notice) => !notice.read && !(!notice.action && isMarked(notice, 'notice-hidden')));
  const chips = waiting.filter((notice) => notice.action && isMarked(notice, 'notice'));
  const cards = waiting.filter((notice) => !chips.includes(notice));
  const extra = cards.length - MAX_CARDS;

  return (
    <>
      {cards.slice(0, MAX_CARDS).map((notice) => {
        const Icon = notice.icon;
        return (
          <div key={notice.id} className={clsx('toast notice', leaving.includes(notice.id) && 'is-leaving')} role="status">
            <button type="button" className="notice-main" onClick={() => open(notice)}>
              <span className={clsx('toast-icon', `is-${notice.tone}`)}>
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="notice-body">
                <span className="notice-title">{notice.title}</span>
                {(notice.batch || notice.detail) && (
                  <span className="notice-meta">
                    {notice.batch && <Badge size="sm">{notice.batch}</Badge>}
                    {notice.detail && <span className="notice-detail">{notice.detail}</span>}
                  </span>
                )}
              </span>
            </button>
            <button
              type="button"
              className="toast-close"
              onClick={() => withExit(notice, () => setMark(notice, notice.action ? 'notice' : 'notice-hidden', true))}
              aria-label={`${notice.action ? 'Collapse' : 'Close'} ${notice.title}`}
            >
              {notice.action ? <ChevronDown size={15} /> : <X size={15} />}
            </button>
          </div>
        );
      })}

      {extra > 0 && (
        <button type="button" className="notice-chip notice-more" onClick={() => window.dispatchEvent(new Event(OPEN_BELL))}>
          +{extra} more
        </button>
      )}

      {chips.map((notice) => {
        const Icon = notice.icon;
        return (
          <button key={notice.id} type="button" className="notice-chip" onClick={() => { setMark(notice, 'notice', false); refresh((count) => count + 1); }} aria-label={`Show ${notice.title}`}>
            <span className={clsx('toast-icon', `is-${notice.tone}`)}>
              <Icon size={16} aria-hidden="true" />
            </span>
            {notice.count}
          </button>
        );
      })}
    </>
  );
}
