import { useMemo, useState } from 'react';
import { BookOpen, SearchX } from 'lucide-react';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import {
  MaterialViewer,
  PortalEmpty,
  PortalList,
  PortalPage,
  PortalRow,
  PortalSection,
  usePortalStudentId,
} from '@/components/portal';
import { getMaterialsForStudent } from '@/lib/supabase';
import type { Material } from '@/lib/types';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { formatDate } from '@/lib/utils/format';

export default function PortalMaterialsPage() {
  const studentId = usePortalStudentId();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [open, setOpen] = useState<Material | null>(null);
  const [query, setQuery] = useState('');
  const [batchId, setBatchId] = useState<string | null>(null);

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;
    setMaterials(await getMaterialsForStudent());
  });

  // Material with no batch is for everyone; it gets its own group and its own
  // filter entry rather than being lumped in with a batch it does not belong to.
  const EVERYONE = '__all__';

  const batches = useMemo(() => {
    const seen = new Map<string, string>();
    for (const material of materials) {
      const key = material.batch_id ?? EVERYONE;
      if (!seen.has(key)) seen.set(key, material.batch_id ? material.batch?.name ?? 'Your batch' : 'For everyone');
    }
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [materials]);

  const matched = useMemo(() => {
    const term = query.trim().toLowerCase();
    return materials.filter((material) => {
      if (batchId && (material.batch_id ?? EVERYONE) !== batchId) return false;
      if (!term) return true;
      return `${material.title} ${material.description ?? ''}`.toLowerCase().includes(term);
    });
  }, [materials, query, batchId]);

  // Grouped by batch, then by folder inside it — a folder is just a column, so
  // this is a group-by rather than a second query.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: Material[] }>();
    for (const material of matched) {
      const batchName = material.batch_id ? material.batch?.name ?? 'Your batch' : 'For everyone';
      const key = `${material.batch_id ?? EVERYONE}::${material.folder ?? ''}`;
      const name = material.folder ? `${batchName} — ${material.folder}` : batchName;
      if (!map.has(key)) map.set(key, { name, items: [] });
      map.get(key)!.items.push(material);
    }
    // Folders after the loose files of the same batch, so a long folder never
    // pushes the batch's own material off the screen.
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, group]) => group);
  }, [matched]);

  const pickBatch = (id: string | null) => {
    setBatchId(id);
  };

  return (
    <PortalPage
      title="Study material"
      loading={loading}
      error={error}
      onRetry={retry}
      shape="list"
      action={
        materials.length > 0 ? (
          <SearchFilterBar
            className="portal-search"
            value={query}
            onChange={setQuery}
            placeholder="Search material"
            label="Search material"
            filterLabel="Filter by batch"
            allLabel="All batches"
            filterValue={batchId}
            filterOptions={batches.map((batch) => ({ value: batch.id, label: batch.name }))}
            onFilterChange={pickBatch}
          />
        ) : undefined
      }
    >
      {materials.length === 0 ? (
        <PortalEmpty icon={BookOpen}>No study material yet.</PortalEmpty>
      ) : matched.length === 0 ? (
        <PortalEmpty icon={SearchX}>Nothing matches that.</PortalEmpty>
      ) : (
        groups.map((group) => (
          <PortalSection key={group.name} title={group.name}>
            <PortalList>
              {group.items.map((material) => (
                <PortalRow
                  key={material.id}
                  primary={material.title}
                  secondary={formatDate(material.created_at)}
                  onClick={() => setOpen(material)}
                  label={`Open ${material.title}`}
                />
              ))}
            </PortalList>
          </PortalSection>
        ))
      )}

      <MaterialViewer material={open} onClose={() => setOpen(null)} />
    </PortalPage>
  );
}
