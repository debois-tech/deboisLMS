import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { getStudentBatches } from '@/lib/supabase';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { Spinner } from '@/components/ui/Spinner';
import type { Batch, BatchStudentMapping } from '@/lib/types';
import { addDays, fromDateValue, toDateValue } from '@/lib/utils/date';

export type PortalEnrolment = BatchStudentMapping & { batch?: Batch };

interface PortalBatchValue {
  mappings: PortalEnrolment[];
  current?: PortalEnrolment;
  batchId: string | null;
  setBatchId: (id: string) => void;
  // The day the account closes, when nothing is running and a finished batch started the countdown
  expiresOn: string | null;
}

const PortalBatchContext = createContext<PortalBatchValue>({ mappings: [], batchId: null, setBatchId: () => {}, expiresOn: null });

const keyFor = (studentId: string) => `portal-batch:${studentId}`;

const readStored = (studentId: string) => {
  try {
    return localStorage.getItem(keyFor(studentId));
  } catch {
    return null;
  }
};

// The batch the whole portal follows; remembered per browser, newest running batch to begin with
export function PortalBatchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const studentId = user?.student_id;
  const [mappings, setMappings] = useState<PortalEnrolment[]>([]);
  const [picked, setPicked] = useState<string | null>(() => (studentId ? readStored(studentId) : null));

  const { loading } = useInitialLoad(async () => {
    if (!studentId) return;
    setMappings(await getStudentBatches(studentId));
  }, true);

  const setBatchId = useCallback((id: string) => {
    setPicked(id);
    if (!studentId) return;
    try {
      localStorage.setItem(keyFor(studentId), id);
    } catch {
      // Storage blocked: the choice lasts until the page reloads
    }
  }, [studentId]);

  const live = mappings.filter((m) => m.status === 'active');
  const newest = (list: PortalEnrolment[]) => [...list].sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())[0];
  const running = live.filter((m) => !m.batch?.ended_at);
  const current = live.find((m) => m.batch_id === picked) ?? newest(running) ?? newest(live) ?? newest(mappings);

  const lastEnd = live.map((m) => m.batch?.ended_at?.slice(0, 10)).filter(Boolean).sort().pop();
  const end = lastEnd ? fromDateValue(lastEnd) : null;
  const expiresOn = running.length === 0 && end ? toDateValue(addDays(end, 90)) : null;

  if (loading) return <Spinner centered />;

  return (
    <PortalBatchContext.Provider value={{ mappings: live.length > 0 ? live : mappings, current, batchId: current?.batch_id ?? null, setBatchId, expiresOn }}>
      {children}
    </PortalBatchContext.Provider>
  );
}

export function usePortalBatch() {
  return useContext(PortalBatchContext);
}
