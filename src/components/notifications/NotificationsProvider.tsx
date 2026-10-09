import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/context/AuthContext';
import { pickPortalBatch } from '@/lib/context/PortalBatchContext';
import { useToast } from '@/lib/context/ToastContext';
import { groupNotifications, useNotices, type Notice } from '@/lib/hooks/useNotices';
import { getMyNotifications, markAllNotificationsRead, markNotificationsRead, subscribeToNotifications } from '@/lib/supabase';
import type { NotificationRow } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';

const POLL_MS = 60_000;

// What the "+N more" chip fires so the bell opens
export const OPEN_BELL = 'notifications-open-bell';

interface NotificationsValue {
  // Live counts first (errors, then the rest), then stored events: unread newest first, read last
  notices: Notice[];
  unread: number;
  // Goes where the notice leads and marks it read
  open: (notice: Notice) => void;
  markRead: (notice: Notice) => void;
  markAllRead: () => void;
  ready: boolean;
}

const NotificationsContext = createContext<NotificationsValue>({ notices: [], unread: 0, open: () => {}, markRead: () => {}, markAllRead: () => {}, ready: false });

const RANK = { error: 0, warning: 1, info: 2, success: 2 } as const;

// One source for the bell, the page and the cards, so a read in one shows in all
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const live = useNotices();
  // Tagged with whose they are, so a sign-out and sign-in never shows the last person's
  const [loaded, setLoaded] = useState<{ owner: string; rows: NotificationRow[] } | null>(null);
  const [listing, setListing] = useState<Notice | null>(null);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(
    () => (userId ? getMyNotifications().then((list) => setLoaded({ owner: userId, rows: list })).catch((err) => console.error('[notifications]', err)) : Promise.resolve()),
    [userId],
  );
  const ready = loaded !== null && loaded.owner === userId;
  const rows = useMemo(() => (loaded && ready ? loaded.rows : []), [ready, loaded]);

  useEffect(() => {
    if (!userId) return;
    void load();
    const stop = subscribeToNotifications(userId, () => void load());
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, [userId, load]);

  const stored = useMemo(() => groupNotifications(rows), [rows]);
  const notices = useMemo(() => {
    const pinned = [...live].sort((a, b) => Number(Boolean(b.action)) - Number(Boolean(a.action)) || RANK[a.tone] - RANK[b.tone]);
    return [...pinned, ...stored.filter((notice) => !notice.read), ...stored.filter((notice) => notice.read)];
  }, [live, stored]);
  const unread = live.length + stored.filter((notice) => !notice.read).length;

  // Shown as read at once; a failed save puts the truth back
  const settle = useCallback((ids: string[] | null, save: Promise<void>) => {
    const now = new Date().toISOString();
    setLoaded((current) => current && { ...current, rows: current.rows.map((row) => (!row.read_at && (!ids || ids.includes(row.id)) ? { ...row, read_at: now } : row)) });
    save.catch((err) => {
      showToast(errorMessage(err, 'Could not mark as read'), 'error');
      void load();
    });
  }, [load, showToast]);

  const markRead = useCallback((notice: Notice) => {
    if (notice.ids && !notice.read) settle(notice.ids, markNotificationsRead(notice.ids));
  }, [settle]);

  const markAllRead = useCallback(() => settle(null, markAllNotificationsRead()), [settle]);

  const open = useCallback((notice: Notice) => {
    markRead(notice);
    if (notice.batchId) pickPortalBatch(notice.batchId);
    const only = notice.rows.length === 1 ? notice.rows[0].to : undefined;
    const target = notice.to ?? only;
    if (target) navigate(target);
    else setListing(notice);
  }, [markRead, navigate]);

  const clear = async () => {
    if (!listing?.clear) return;
    setClearing(true);
    try {
      await listing.clear();
      setListing(null);
    } catch (err) {
      showToast(errorMessage(err, 'Could not clear these'), 'error');
    } finally {
      setClearing(false);
    }
  };

  return (
    <NotificationsContext.Provider value={{ notices, unread, open, markRead, markAllRead, ready }}>
      {children}
      <Modal
        open={listing !== null}
        onClose={() => setListing(null)}
        title={listing?.title ?? ''}
        size="lg"
        footer={
          listing?.clear && (
            <Button variant="secondary" className="action-button-compact" onClick={() => void clear()} loading={clearing}>Clear all</Button>
          )
        }
      >
        <div className="flex flex-col gap-3">
          {listing?.rows.map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] break-words">{row.primary}</p>
                {row.meta?.map((line) => <p key={line} className="text-xs text-[var(--text-muted)]">{line}</p>)}
              </div>
              {row.to && (
                <Link to={row.to} onClick={() => setListing(null)} className="shrink-0 text-xs font-semibold text-[var(--primary)] hover:underline">Open</Link>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
