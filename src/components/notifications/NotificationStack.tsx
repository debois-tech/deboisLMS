import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/lib/context/ToastContext';
import { useNotices, type Notice } from '@/lib/hooks/useNotices';
import { errorMessage } from '@/lib/utils/errors';

// What was on the notice when it was collapsed: it stays collapsed until something new appears
const signature = (notice: Notice) => `${notice.count}:${notice.rows.map((row) => row.key).join(',')}`;
const storageKey = (notice: Notice) => `notice:${notice.id}`;

function isCollapsed(notice: Notice) {
  try {
    return localStorage.getItem(storageKey(notice)) === signature(notice);
  } catch {
    return false;
  }
}

function setCollapsed(notice: Notice, collapsed: boolean) {
  try {
    if (collapsed) localStorage.setItem(storageKey(notice), signature(notice));
    else localStorage.removeItem(storageKey(notice));
  } catch {
    // Storage blocked: the notice just stays open
  }
}

// Stacked, collapsible notices for the signed-in admin or tutor; View opens the full list
export function NotificationStack() {
  const notices = useNotices();
  const [open, setOpen] = useState<Notice | null>(null);
  const [clearing, setClearing] = useState(false);
  const [, refresh] = useState(0);
  const { showToast } = useToast();

  const toggle = (notice: Notice, collapsed: boolean) => {
    setCollapsed(notice, collapsed);
    refresh((count) => count + 1);
  };

  const clear = async () => {
    if (!open?.clear) return;
    setClearing(true);
    try {
      await open.clear();
      setOpen(null);
    } catch (err) {
      showToast(errorMessage(err, 'Could not clear these'), 'error');
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      {notices.map((notice) => {
        const Icon = notice.icon;
        const icon = (
          <span className={clsx('toast-icon', `is-${notice.tone}`)}>
            <Icon size={16} aria-hidden="true" />
          </span>
        );

        if (isCollapsed(notice)) {
          return (
            <button key={notice.id} type="button" className="notice-chip" onClick={() => toggle(notice, false)} aria-label={`Show ${notice.title}`}>
              {icon}
              {notice.count}
            </button>
          );
        }

        return (
          <div key={notice.id} className="toast notice" role="status">
            {icon}
            <div className="notice-body">
              <p className="notice-title">{notice.title}</p>
              <div className="notice-actions">
                {notice.rows.length > 0 ? (
                  <Button size="sm" variant="secondary" className="action-button-compact" onClick={() => setOpen(notice)}>View</Button>
                ) : notice.to ? (
                  <Link to={notice.to}><Button size="sm" variant="secondary" className="action-button-compact">View</Button></Link>
                ) : null}
              </div>
            </div>
            <button type="button" className="toast-close" onClick={() => toggle(notice, true)} aria-label={`Collapse ${notice.title}`}>
              <ChevronDown size={15} />
            </button>
          </div>
        );
      })}

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.title ?? ''}
        size="lg"
        footer={
          open?.clear && (
            <Button variant="secondary" className="action-button-compact" onClick={() => void clear()} loading={clearing}>Clear all</Button>
          )
        }
      >
        <div className="flex flex-col gap-3">
          {open?.rows.map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] break-words">{row.primary}</p>
                {row.meta?.map((line) => <p key={line} className="text-xs text-[var(--text-muted)]">{line}</p>)}
              </div>
              {row.to && (
                <Link to={row.to} onClick={() => setOpen(null)} className="shrink-0 text-xs font-semibold text-[var(--primary)] hover:underline">Open</Link>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
