import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from '@/components/ui/Badge';
import type { Notice } from '@/lib/hooks/useNotices';
import { timeAgo } from '@/lib/utils/format';

interface NotificationRowProps {
  notice: Notice;
  onOpen: (notice: Notice) => void;
  onMarkRead: (notice: Notice) => void;
}

// One notification in the bell and on the page: the row leads somewhere, the tick greys it out
export function NotificationRow({ notice, onOpen, onMarkRead }: NotificationRowProps) {
  const Icon = notice.icon;
  const unread = notice.ids ? !notice.read : true;

  return (
    <div className={clsx('notif-row', !unread && 'is-read')}>
      <button type="button" className="notif-row-main" onClick={() => onOpen(notice)}>
        <span className={clsx('toast-icon', `is-${notice.tone}`)}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="notif-row-text">
          <span className="notif-row-title">
            {notice.title}
            {notice.batch && <Badge size="sm">{notice.batch}</Badge>}
          </span>
          {notice.detail && <span className="notif-row-detail">{notice.detail}</span>}
          {notice.at && <span className="notif-row-time">{timeAgo(notice.at)}</span>}
        </span>
        {unread && notice.ids && <span className="notif-row-dot" aria-label="Unread" />}
      </button>
      {unread && notice.ids && (
        <button type="button" className="notif-row-read" onClick={() => onMarkRead(notice)} aria-label={`Mark ${notice.title} read`}>
          <Check size={15} />
        </button>
      )}
    </div>
  );
}
