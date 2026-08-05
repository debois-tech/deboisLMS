import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Eye } from 'lucide-react';
import { getMaterialViews } from '@/lib/supabase';
import type { Material, MaterialView } from '@/lib/types';
import { formatDateTime } from '@/lib/utils/format';
import { errorMessage } from '@/lib/utils/errors';

/** Who opened a material and when — the other half of the watermark. */
export function MaterialViewsModal({ material, onClose }: { material: Material | null; onClose: () => void }) {
  const [result, setResult] = useState<{ materialId: string; views: MaterialView[]; error?: string } | null>(null);

  useEffect(() => {
    if (!material) return;
    let active = true;

    (async () => {
      try {
        const views = await getMaterialViews(material.id);
        if (active) setResult({ materialId: material.id, views });
      } catch (err) {
        if (active) {
          setResult({ materialId: material.id, views: [], error: errorMessage(err, "Couldn't load the open log.") });
        }
      }
    })();

    return () => { active = false; };
  }, [material]);

  const loaded = material !== null && result?.materialId === material.id;
  const views = loaded ? result.views : [];

  return (
    <Modal
      open={material !== null}
      onClose={onClose}
      title={material ? `Opens — ${material.title}` : ''}
      footer={<Button className="action-button-compact" onClick={onClose}>Done</Button>}
    >
      {!loaded ? (
        <Spinner centered />
      ) : result.error ? (
        <ErrorState message={result.error} />
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
