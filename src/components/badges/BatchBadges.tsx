import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import {
  BADGE_ACCEPT,
  BADGE_EXTENSIONS,
  BADGE_MAX_BYTES,
  badgeImageUrl,
  createBatchBadge,
  deleteBatchBadge,
  getBadgeHolders,
  getBatchBadges,
  getBatchStudents,
  giveBadge,
  takeBadge,
} from '@/lib/supabase';
import type { BadgeHolder, BadgeWithHolders } from '@/lib/supabase';
import type { Student } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';
import { extensionOf, filesFromDataTransfer } from '@/lib/utils/files';
import { formatDate, formatFileSize } from '@/lib/utils/format';

/** A batch's badges: upload the art, give it to students, take it back. Shared by admin and tutor. */
export function BatchBadges({ batchId }: { batchId: string }) {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [badges, setBadges] = useState<BadgeWithHolders[]>([]);
  const [adding, setAdding] = useState(false);
  const [giving, setGiving] = useState<BadgeWithHolders | null>(null);
  const [holding, setHolding] = useState<BadgeWithHolders | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    setBadges(await getBatchBadges(batchId));
  });

  const reload = async () => setBadges(await getBatchBadges(batchId));

  const remove = async (badge: BadgeWithHolders) => {
    const accepted = await confirm({
      title: `Delete "${badge.name}"?`,
      message: badge.holders > 0
        ? `${badge.holders} ${badge.holders === 1 ? 'student loses' : 'students lose'} it too. This cannot be undone.`
        : 'This cannot be undone.',
      confirmLabel: 'Delete badge',
      danger: true,
    });
    if (!accepted) return;
    try {
      await deleteBatchBadge(badge);
      await reload();
      showToast('Badge deleted');
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete the badge'), 'error');
    }
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button className="action-button-compact" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add badge
        </Button>
      </div>

      {badges.length === 0 ? (
        <EmptyState
          icon={<Award size={22} />}
          title="No badges for this batch yet"        />
      ) : (
        <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]">
          {badges.map((badge) => (
            <li key={badge.id} className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)]">
              <div className="grid aspect-square place-items-center bg-[var(--bg-elevated)] p-5">
                <img src={badgeImageUrl(badge.image_path)} alt={badge.name} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{badge.name}</p>
                {badge.description && (
                  <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">{badge.description}</p>
                )}
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {badge.holders === 0 ? 'Not given yet' : `${badge.holders} ${badge.holders === 1 ? 'student' : 'students'}`}
                </p>
              </div>
              <div className="flex items-center gap-2 p-4 pt-0">
                <Button className="action-button-compact" onClick={() => setGiving(badge)}>Give</Button>
                <Button
                  variant="secondary"
                  className="action-button-compact"
                  onClick={() => setHolding(badge)}
                  disabled={badge.holders === 0}
                >
                  Holders
                </Button>
                <button
                  type="button"
                  className="ml-auto grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--danger-text)]"
                  aria-label={`Delete ${badge.name}`}
                  onClick={() => void remove(badge)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddBadgeModal
        key={adding ? 'open' : 'closed'}
        open={adding}
        batchId={batchId}
        onClose={() => setAdding(false)}
        onSaved={async () => {
          setAdding(false);
          await reload();
          showToast('Badge added');
        }}
      />
      <GiveBadgeModal
        key={giving?.id ?? 'none'}
        badge={giving}
        batchId={batchId}
        onClose={() => setGiving(null)}
        onGiven={async (count) => {
          setGiving(null);
          await reload();
          showToast(`Badge given to ${count} ${count === 1 ? 'student' : 'students'}`);
        }}
      />
      <HoldersModal
        key={holding?.id ?? 'none'}
        badge={holding}
        onClose={() => setHolding(null)}
        onChanged={reload}
      />
    </div>
  );
}

function AddBadgeModal({ open, batchId, onClose, onSaved }: {
  open: boolean;
  batchId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const takeFile = (chosen?: File) => {
    if (!chosen) return;
    if (!(BADGE_EXTENSIONS as readonly string[]).includes(extensionOf(chosen.name))) {
      showToast('Use a PNG, JPEG or WebP image.', 'error');
    } else if (chosen.size > BADGE_MAX_BYTES) {
      showToast(`${formatFileSize(chosen.size)} is too big. The limit is 5 MB.`, 'error');
    } else {
      setFile(chosen);
    }
  };

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    takeFile(chosen);
  };

  const drop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (saving) return;
    const [dropped] = await filesFromDataTransfer(event.dataTransfer);
    takeFile(dropped?.file);
  };

  const save = async () => {
    if (!file) return;
    setSaving(true);
    try {
      await createBatchBadge({ batchId, name: name.trim(), description: description.trim(), file });
      await onSaved();
    } catch (err) {
      showToast(errorMessage(err, 'Could not add the badge'), 'error');
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Add badge"
      footer={
        <>
          <Button className="cancel-button-compact" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="action-button-compact" onClick={() => void save()} loading={saving} disabled={!name.trim() || !file}>
            Add badge
          </Button>
        </>
      }
    >
      <div className="popup-form-spaced">
        <FormField label="Name" required>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Linux Fundamentals" />
        </FormField>
        <FormField label="Description">
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={300} />
        </FormField>
        <FormField label="Image" required>
          <label
            className={`import-dropzone${dragOver ? ' is-active' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => void drop(event)}
          >
            <ImagePlus size={16} />
            {dragOver ? 'Drop to use this image' : file ? 'Choose a different image, or drop one' : 'PNG, JPEG or WebP, up to 5 MB — drag and drop or click'}
            <input ref={fileRef} type="file" accept={BADGE_ACCEPT} onChange={pick} className="hidden" disabled={saving} />
          </label>
          {preview && (
            <div className="mt-3 grid place-items-center rounded-[var(--radius-md)] bg-[var(--bg-elevated)] p-4">
              <img src={preview} alt="Badge preview" className="max-h-48 object-contain" />
            </div>
          )}
        </FormField>
      </div>
    </Modal>
  );
}

function GiveBadgeModal({ badge, batchId, onClose, onGiven }: {
  badge: BadgeWithHolders | null;
  batchId: string;
  onClose: () => void;
  onGiven: (count: number) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [has, setHas] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!badge) return;
    let active = true;
    Promise.all([getBatchStudents(batchId), getBadgeHolders(badge.id)])
      .then(([roster, holders]) => {
        if (!active) return;
        const held = new Set(holders.map((holder) => holder.student_id));
        const current = roster.filter((student) => student.mapping.status === 'active');
        setStudents(current);
        setHas(held);
        // Everyone who does not have it yet: the common case is the whole batch.
        setPicked(new Set(current.filter((student) => !held.has(student.id)).map((student) => student.id)));
      })
      .catch((err) => active && setFailed(errorMessage(err, 'Could not load the students')));
    return () => { active = false; };
  }, [badge, batchId]);

  const eligible = (students ?? []).filter((student) => !has.has(student.id));

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const give = async () => {
    if (!badge) return;
    setSaving(true);
    try {
      await giveBadge(badge.id, [...picked]);
      await onGiven(picked.size);
    } catch (err) {
      showToast(errorMessage(err, 'Could not give the badge'), 'error');
      setSaving(false);
    }
  };

  return (
    <Modal
      open={badge !== null}
      onClose={saving ? () => {} : onClose}
      title={badge ? `Give "${badge.name}"` : ''}
      footer={
        <>
          <Button className="cancel-button-compact" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="action-button-compact" onClick={() => void give()} loading={saving} disabled={picked.size === 0}>
            {picked.size === 0 ? 'Give' : `Give to ${picked.size}`}
          </Button>
        </>
      }
    >
      {failed ? (
        <p className="text-sm text-[var(--danger-text)]">{failed}</p>
      ) : !students ? (
        <Spinner centered />
      ) : students.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No active students in this batch.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>{picked.size} of {eligible.length} selected</span>
            <span className="flex gap-3">
              <button type="button" className="font-semibold text-[var(--primary)] underline underline-offset-2" onClick={() => setPicked(new Set(eligible.map((s) => s.id)))}>All</button>
              <button type="button" className="font-semibold text-[var(--primary)] underline underline-offset-2" onClick={() => setPicked(new Set())}>None</button>
            </span>
          </div>
          <ul className="max-h-80 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)]">
            {students.map((student) => {
              const already = has.has(student.id);
              return (
                <li key={student.id} className="border-b border-[var(--border)] last:border-b-0">
                  <label className={`flex items-center gap-3 px-3 py-2.5 text-sm ${already ? 'opacity-60' : 'cursor-pointer hover:bg-[var(--bg-elevated)]'}`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={!already && picked.has(student.id)}
                      disabled={already}
                      onChange={() => toggle(student.id)}
                    />
                    <span className="flex-1 text-[var(--text-primary)]">{student.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{already ? 'Already has it' : student.student_code}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}

function HoldersModal({ badge, onClose, onChanged }: {
  badge: BadgeWithHolders | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [holders, setHolders] = useState<BadgeHolder[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!badge) return;
    let active = true;
    getBadgeHolders(badge.id)
      .then((found) => active && setHolders(found))
      .catch((err) => active && setFailed(errorMessage(err, 'Could not load who holds this badge')));
    return () => { active = false; };
  }, [badge]);

  const take = async (holder: BadgeHolder) => {
    const accepted = await confirm({
      title: `Take "${badge?.name}" from ${holder.student.name}?`,
      message: 'It disappears from their profile. A copy they already shared elsewhere stays.',
      confirmLabel: 'Take back',
      danger: true,
    });
    if (!accepted) return;
    try {
      await takeBadge(holder.id);
      setHolders((current) => current?.filter((item) => item.id !== holder.id) ?? null);
      await onChanged();
      showToast('Badge taken back');
    } catch (err) {
      showToast(errorMessage(err, 'Could not take the badge back'), 'error');
    }
  };

  return (
    <Modal open={badge !== null} onClose={onClose} title={badge ? `Who has "${badge.name}"` : ''}>
      {failed ? (
        <p className="text-sm text-[var(--danger-text)]">{failed}</p>
      ) : !holders ? (
        <Spinner centered />
      ) : holders.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No one has this badge.</p>
      ) : (
        <ul className="max-h-96 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)]">
          {holders.map((holder) => (
            <li key={holder.id} className="flex items-center gap-3 border-b border-[var(--border)] px-3 py-2.5 text-sm last:border-b-0">
              <span className="flex-1">
                <span className="block text-[var(--text-primary)]">{holder.student.name}</span>
                <span className="block text-xs text-[var(--text-muted)]">Given {formatDate(holder.issued_at)}</span>
              </span>
              <Button variant="secondary" className="action-button-compact" onClick={() => void take(holder)}>Take back</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
