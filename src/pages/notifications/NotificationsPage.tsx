import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { PortalEmpty, PortalPage, PortalTabs } from '@/components/portal';
import { NotificationRow } from '@/components/notifications/NotificationRow';
import { useNotifications } from '@/components/notifications/NotificationsProvider';
import { useAuth } from '@/lib/context/AuthContext';
import type { Notice } from '@/lib/hooks/useNotices';

type Filter = 'all' | 'unread';

const isUnread = (notice: Notice) => (notice.ids ? !notice.read : true);

// All notifications for the signed-in admin, tutor or student
export default function NotificationsPage() {
  const { isStudent } = useAuth();
  const { notices, open, markRead, markAllRead, ready } = useNotifications();
  const [filter, setFilter] = useState<Filter>('all');

  const unread = notices.filter(isUnread);
  const shown = filter === 'unread' ? unread : notices;
  const tabs = [
    { value: 'all' as const, label: 'All', count: notices.length },
    { value: 'unread' as const, label: 'Unread', count: unread.length },
  ];

  const markAll = (
    <Button variant="secondary" size="sm" className="action-button-compact" onClick={markAllRead} disabled={!notices.some((notice) => notice.ids && !notice.read)}>
      Mark all read
    </Button>
  );

  const list = shown.length === 0 ? (
    isStudent ? <PortalEmpty icon={Bell}>Nothing here.</PortalEmpty> : <EmptyState icon={<Bell size={20} />} title="Nothing here" />
  ) : (
    <div className="notif-page-list">
      {shown.map((notice) => <NotificationRow key={notice.id} notice={notice} onOpen={open} onMarkRead={markRead} />)}
    </div>
  );

  if (isStudent) {
    return (
      <PortalPage title="Notifications" action={markAll} loading={!ready} shape="list">
        <PortalTabs tabs={tabs} value={filter} onChange={setFilter} label="Filter notifications" />
        {list}
      </PortalPage>
    );
  }

  return (
    <div className="page-section narrow">
      <PageHeader title="Notifications" action={markAll} />
      <FilterTabs tabs={tabs} value={filter} onChange={setFilter} label="Filter notifications" />
      {list}
    </div>
  );
}
