import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { NotificationRow } from '@/components/notifications/NotificationRow';
import { OPEN_BELL, useNotifications } from '@/components/notifications/NotificationsProvider';
import { useAuth } from '@/lib/context/AuthContext';
import type { Notice } from '@/lib/hooks/useNotices';

const SHOWN = 8;

// Top-right bell for all three dashboards: the count, and the latest few with a way to read them
export function NotificationBell() {
  const { notices, unread, open, markRead, markAllRead } = useNotifications();
  const { isAdmin, isTutor } = useAuth();
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const page = isAdmin ? '/notifications' : isTutor ? '/tutor/notifications' : '/portal/notifications';

  useEffect(() => {
    const show = () => setShown(true);
    window.addEventListener(OPEN_BELL, show);
    return () => window.removeEventListener(OPEN_BELL, show);
  }, []);

  useEffect(() => {
    if (!shown) return;
    const outside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setShown(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShown(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [shown]);

  const go = (notice: Notice) => {
    setShown(false);
    open(notice);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="notif-bell"
        onClick={() => setShown((on) => !on)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={shown}
      >
        <Bell size={18} />
        {unread > 0 && <span key={unread} className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {shown && (
        <div className="notif-panel animate-dropdown" role="region" aria-label="Notifications">
          <div className="notif-panel-head">
            <p className="notif-panel-title">Notifications</p>
            <button type="button" className="notif-link" onClick={markAllRead} disabled={!notices.some((notice) => notice.ids && !notice.read)}>
              Mark all read
            </button>
          </div>
          <div className="notif-panel-list">
            {notices.length === 0 ? (
              <p className="notif-empty">Nothing yet</p>
            ) : (
              notices.slice(0, SHOWN).map((notice) => <NotificationRow key={notice.id} notice={notice} onOpen={go} onMarkRead={markRead} />)
            )}
          </div>
          <Link to={page} className="notif-panel-foot" onClick={() => setShown(false)}>View all</Link>
        </div>
      )}
    </div>
  );
}
