import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, SearchX } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';
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
import { formatDate } from '@/lib/utils/format';

export default function PortalMaterialsPage() {
  const studentId = usePortalStudentId();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [open, setOpen] = useState<Material | null>(null);
  const [query, setQuery] = useState('');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    let active = true;
    getMaterialsForStudent().then((data) => {
      if (!active) return;
      setMaterials(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [studentId]);

  const batches = useMemo(() => {
    const seen = new Map<string, string>();
    for (const material of materials) {
      if (!seen.has(material.batch_id)) seen.set(material.batch_id, material.batch?.name ?? 'Your batch');
    }
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [materials]);

  const matched = useMemo(() => {
    const term = query.trim().toLowerCase();
    return materials.filter((material) => {
      if (batchId && material.batch_id !== batchId) return false;
      if (!term) return true;
      return `${material.title} ${material.description ?? ''}`.toLowerCase().includes(term);
    });
  }, [materials, query, batchId]);

  // Grouped by batch, since a student in two batches would otherwise get one
  // undifferentiated pile of PDFs.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: Material[] }>();
    for (const material of matched) {
      const name = material.batch?.name ?? 'Your batch';
      if (!map.has(material.batch_id)) map.set(material.batch_id, { name, items: [] });
      map.get(material.batch_id)!.items.push(material);
    }
    return [...map.values()];
  }, [matched]);

  const pickBatch = (id: string | null) => {
    setBatchId(id);
    setFilterOpen(false);
  };

  return (
    <PortalPage
      title="Study material"
      loading={loading}
      shape="list"
      action={
        materials.length > 0 ? (
          <SearchBar
            className="portal-search"
            value={query}
            onChange={setQuery}
            placeholder="Search material"
            label="Search material"
            filter={batches.length > 0 ? {
              open: filterOpen,
              onOpenChange: setFilterOpen,
              active: batchId !== null,
              label: 'Filter by batch',
              panel: (
                <div className="searchbar-panel-scroll" role="listbox">
                  <button
                    type="button"
                    role="option"
                    aria-selected={batchId === null}
                    onClick={() => pickBatch(null)}
                    className="searchbar-option"
                  >
                    <span>All batches</span>
                    {batchId === null && <Check size={16} className="text-[var(--primary)]" />}
                  </button>
                  {batches.map((batch) => (
                    <button
                      key={batch.id}
                      type="button"
                      role="option"
                      aria-selected={batchId === batch.id}
                      onClick={() => pickBatch(batch.id)}
                      className="searchbar-option"
                    >
                      <span>{batch.name}</span>
                      {batchId === batch.id && <Check size={16} className="text-[var(--primary)]" />}
                    </button>
                  ))}
                </div>
              ),
            } : undefined}
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
