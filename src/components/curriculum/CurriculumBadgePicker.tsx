import { useState } from 'react';
import { Award, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/lib/context/ToastContext';
import { badgeImageUrl } from '@/lib/supabase';
import type { BatchBadge, CurriculumNode } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';

interface CurriculumBadgePickerProps {
  node: CurriculumNode | null;
  // The batch's badges
  library: BatchBadge[];
  // The ones already on the card
  chosen: string[];
  onClose: () => void;
  onSave: (ids: string[]) => Promise<void>;
}

// Pick which of the batch's badges a card carries; mount it keyed by the card so the ticks start from what it has
export function CurriculumBadgePicker({ node, library, chosen, onClose, onSave }: CurriculumBadgePickerProps) {
  const { showToast } = useToast();
  const [picked, setPicked] = useState<string[]>(chosen);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setPicked((now) => (now.includes(id) ? now.filter((item) => item !== id) : [...now, id]));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(picked);
    } catch (err) {
      showToast(errorMessage(err, 'Could not save the badges'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={node !== null}
      onClose={onClose}
      title={`Badges for ${node?.title || node?.kind || ''}`}
      footer={
        library.length > 0 && (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button className="action-button-compact" loading={saving} onClick={() => void save()}>Save</Button>
          </>
        )
      }
    >
      {library.length === 0 ? (
        <EmptyState icon={<Award size={20} />} title="No badges in this batch yet" />
      ) : (
        <ul className="cv-badge-grid">
          {library.map((badge) => {
            const on = picked.includes(badge.id);
            return (
              <li key={badge.id}>
                <button type="button" className={clsx('cv-badge-option', on && 'is-on')} aria-pressed={on} onClick={() => toggle(badge.id)}>
                  <img src={badgeImageUrl(badge.image_path)} alt="" />
                  <span>{badge.name}</span>
                  {on && <Check size={14} className="cv-badge-tick" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
