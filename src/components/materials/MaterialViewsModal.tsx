import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Eye } from 'lucide-react';
import { getMaterialViews } from '@/lib/supabase';
import type { Material, MaterialView } from '@/lib/types';
import { formatDateTime } from '@/lib/utils/format';

/**
 * Who opened a material, and when. This is the other half of the watermark: the
 * stamp on a leaked page names a student, and this says when they opened it.
 */
export function MaterialViewsModal({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const [views, setViews] = useState<MaterialView[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!material) return;
    let active = true;
    setLoading(true);
    getMaterialViews(material.id).then((data) => {
      if (!active) return;
      setViews(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [material]);

  return (
    <Modal
      open={material !== null}
      onClose={onClose}
      title={material ? `Opens — ${material.title}` : ''}
      footer={<Button className="action-button-compact" onClick={onClose}>Done</Button>}
    >
      {loading ? (
        <Spinner centered />
      ) : views.length === 0 ? (
        <EmptyState icon={<Eye size={32} />} title="Not opened yet" />
      ) : (
        <div className="material-views">
          {views.map((view) => (
            <div key={view.id} className="material-view-row">
              <span className="material-view-name">{view.student?.name ?? 'Student'}</span>
              <span className="material-view-time">{formatDateTime(view.viewed_at)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
