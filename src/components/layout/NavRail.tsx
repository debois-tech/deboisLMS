import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronDown, ClipboardCheck, ClipboardList, DollarSign, FileText, GraduationCap, History, BookOpen,
  Layers, LayoutDashboard, LibraryBig, MessageSquare, PanelLeft, Plus, ScrollText, Users, X,
} from 'lucide-react';

export interface Leaf {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

// One item = a direct link; more = a hub with a flyout (rail) or tiles (wide).
export interface Group {
  id: string;
  label: string;
  icon: LucideIcon;
  items: Leaf[];
}

export const ADMIN_GROUPS: Group[] = [
  { id: 'home', label: 'Dashboard', icon: LayoutDashboard, items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true }] },
  {
    id: 'people', label: 'People', icon: Users, items: [
      { label: 'Students', to: '/students', icon: Users },
      { label: 'Tutors', to: '/tutors', icon: GraduationCap },
      { label: 'Tutor Log', to: '/tutor-log', icon: History },
      { label: 'Documents', to: '/documents', icon: ScrollText },
    ],
  },
  {
    id: 'teaching', label: 'Teaching', icon: Layers, items: [
      { label: 'Batches', to: '/batches', icon: Layers },
      { label: 'Attendance', to: '/attendance', icon: ClipboardCheck },
      { label: 'Assignments', to: '/assignments', icon: FileText },
      { label: 'Exams', to: '/exams', icon: ClipboardList },
      { label: 'Feedback', to: '/feedback', icon: MessageSquare },
    ],
  },
  {
    id: 'content', label: 'Content', icon: LibraryBig, items: [
      { label: 'Curriculum', to: '/curriculum', icon: LibraryBig },
      { label: 'Study Material', to: '/materials', icon: BookOpen },
    ],
  },
  { id: 'money', label: 'Money', icon: DollarSign, items: [{ label: 'Finance', to: '/fees', icon: DollarSign }] },
];
export const ADMIN_NEW = { label: 'New Batch', to: '/batches/new' };

export const TUTOR_GROUPS: Group[] = [
  { id: 'home', label: 'Dashboard', icon: LayoutDashboard, items: [{ label: 'Dashboard', to: '/tutor', icon: LayoutDashboard, end: true }] },
  { id: 'students', label: 'Students', icon: Users, items: [{ label: 'Students', to: '/tutor/students', icon: Users }] },
  {
    id: 'teaching', label: 'Teaching', icon: Layers, items: [
      { label: 'Attendance', to: '/tutor/attendance', icon: ClipboardCheck },
      { label: 'Assignments', to: '/tutor/assignments', icon: FileText },
      { label: 'Exams', to: '/tutor/exams', icon: ClipboardList },
    ],
  },
  {
    id: 'content', label: 'Content', icon: LibraryBig, items: [
      { label: 'Curriculum', to: '/tutor/curriculum', icon: LibraryBig },
      { label: 'Study Material', to: '/tutor/materials', icon: BookOpen },
    ],
  },
];

const DESKTOP = '(min-width: 1024px)';
const watchDesktop = (notify: () => void) => {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const useDesktop = () => useSyncExternalStore(watchDesktop, () => window.matchMedia(DESKTOP).matches, () => true);

interface NavRailProps {
  groups: Group[];
  /** The bottom "+ New" shortcut; none for a role that has nothing to create. */
  newAction?: { label: string; to: string } | null;
  /** Mobile drawer. */
  open: boolean;
  /** Desktop rail (true) or wide (false). The drawer is always wide. */
  collapsed: boolean;
  onClose: () => void;
  onToggle: () => void;
}

// Icon rail with a hover flyout, or a wide sidebar with tiles under each hub.
export function NavRail({ groups, newAction, open, collapsed, onClose, onToggle }: NavRailProps) {
  const { pathname } = useLocation();
  const desktop = useDesktop();
  const wide = !desktop || !collapsed;

  const isActive = (leaf: Leaf) =>
    leaf.end ? pathname === leaf.to : pathname === leaf.to || pathname.startsWith(`${leaf.to}/`);
  const current = groups.find((group) => group.items.some(isActive))?.id;

  // A hub the tutor folded or opened by hand wins; the rest follow the current page.
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => manual[id] ?? id === current;

  // `hub` is the hovered hub; `shown` outlives it so the flyout keeps its content while it slides out.
  const [hub, setHub] = useState<string | null>(null);
  const [shown, setShown] = useState((groups.find((group) => group.items.length > 1) ?? groups[0]).id);
  const timer = useRef<number>(0);
  const panel = useRef<HTMLDivElement>(null);
  const show = (id: string) => {
    window.clearTimeout(timer.current);
    setHub(id);
    setShown(id);
  };
  // A short grace so a diagonal move from the rail to the flyout does not close it.
  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHub(null), 140);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flyout = groups.find((group) => group.id === shown)!;
  const flyoutOpen = !wide && hub !== null;

  // With a pointer the flyout stays put while the page loads and closes when the pointer leaves; touch has no leave.
  const pick = () => {
    if (!window.matchMedia('(hover: hover)').matches) setHub(null);
    onClose();
  };

  return (
    <>
      <div className={clsx('nav2-scrim', open && 'is-open')} onClick={onClose} />

      <aside
        className={clsx('nav2', wide && 'is-wide', open && 'is-open')}
        onMouseLeave={hide}
        onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && hide()}
        onKeyDown={(event) => event.key === 'Escape' && setHub(null)}
      >
        <div className="nav2-head">
          <span>Menu</span>
          <button type="button" onClick={onClose} aria-label="Close menu"><X size={18} /></button>
        </div>

        <div className="nav2-top">
          <button
            type="button"
            className="nav2-row nav2-toggle"
            onClick={onToggle}
            onMouseEnter={hide}
            aria-label={wide ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span className="nav2-ico"><PanelLeft size={18} /></span>
            <span className="nav2-label">Collapse</span>
          </button>
        </div>

        <nav className="nav2-scroll" aria-label="Main">
          {groups.map((group) => {
            const Icon = group.icon;
            const direct = group.items.length === 1;
            const lit = current === group.id;
            const unfolded = wide && isOpen(group.id);

            if (direct) {
              return (
                <Link
                  key={group.id}
                  to={group.items[0].to}
                  onClick={pick}
                  onMouseEnter={hide}
                  aria-current={lit ? 'page' : undefined}
                  className={clsx('nav2-row is-direct', lit && 'is-active')}
                >
                  <span className="nav2-ico"><Icon size={20} /></span>
                  <span className="nav2-label">{group.label}</span>
                </Link>
              );
            }

            return (
              <div key={group.id} className="nav2-group">
                <button
                  type="button"
                  className={clsx('nav2-row', lit && 'is-active', !wide && hub === group.id && 'is-hub')}
                  aria-expanded={wide ? unfolded : flyoutOpen && hub === group.id}
                  onMouseEnter={() => !wide && show(group.id)}
                  onFocus={() => !wide && show(group.id)}
                  onClick={() => {
                    if (wide) {
                      setManual((state) => ({ ...state, [group.id]: !unfolded }));
                      return;
                    }
                    show(group.id);
                    requestAnimationFrame(() => panel.current?.querySelector('a')?.focus());
                  }}
                >
                  <span className="nav2-ico"><Icon size={20} /></span>
                  <span className="nav2-label">{group.label}</span>
                  <ChevronDown size={16} className={clsx('nav2-chev', unfolded && 'is-open')} />
                </button>

                <div className="nav2-kids" data-open={unfolded}>
                  <div className="nav2-clip">
                    <div className="nav2-tiles">
                      {group.items.map((leaf) => {
                        const LeafIcon = leaf.icon;
                        return (
                          <Link
                            key={leaf.to}
                            to={leaf.to}
                            onClick={pick}
                            aria-current={isActive(leaf) ? 'page' : undefined}
                            className={clsx('nav2-tile', isActive(leaf) && 'is-active')}
                          >
                            <LeafIcon size={20} />
                            <span>{leaf.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {newAction && (
          <div className="nav2-bottom">
            <Link to={newAction.to} onClick={pick} onMouseEnter={hide} className="nav2-new" aria-label={newAction.label}>
              <span className="nav2-ico"><Plus size={18} /></span>
              <span className="nav2-label">{newAction.label}</span>
            </Link>
          </div>
        )}

        <div className="nav2-fly-clip">
          <div ref={panel} className={clsx('nav2-fly', flyoutOpen && 'is-open')} aria-hidden={!flyoutOpen}>
            <div key={flyout.id} className="nav2-fly-body">
              <p className="nav2-fly-title">{flyout.label}</p>
              {flyout.items.map((leaf) => {
                const LeafIcon = leaf.icon;
                return (
                  <Link
                    key={leaf.to}
                    to={leaf.to}
                    onClick={pick}
                    aria-current={isActive(leaf) ? 'page' : undefined}
                    className={clsx('nav2-fly-row', isActive(leaf) && 'is-active')}
                  >
                    <LeafIcon size={18} />
                    <span>{leaf.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
