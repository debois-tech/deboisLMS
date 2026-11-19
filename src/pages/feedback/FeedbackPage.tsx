import { useState } from 'react';
import { MessageSquare, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { StatusPill } from '@/components/ui/StatusPill';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { getFeedback, setFeedbackStatus } from '@/lib/supabase';
import type { Feedback, FeedbackStatus } from '@/lib/types';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

const TABS: { value: FeedbackStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

export default function FeedbackPage() {
  const [reports, setReports] = useState<Feedback[]>([]);
  const [status, setStatus] = useState<FeedbackStatus>('open');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const { showToast } = useToast();

  const { loading, error, retry } = useInitialLoad(async () => {
    setReports(await getFeedback());
  });

  const term = search.trim().toLowerCase();
  const matches = (report: Feedback) =>
    !term ||
    `${report.message} ${report.reporter_name ?? ''} ${report.reporter_role ?? ''}`
      .toLowerCase()
      .includes(term);

  const searched = reports.filter(matches);
  const tabs = TABS.map((tab) => ({
    ...tab,
    count: searched.filter((report) => report.status === tab.value).length,
  }));
  const visible = searched.filter((report) => report.status === status);

  const move = async (report: Feedback, next: FeedbackStatus) => {
    setBusy(report.id);
    try {
      await setFeedbackStatus(report.id, next);
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status: next } : r)));
      showToast(next === 'resolved' ? 'Marked resolved' : 'Reopened');
    } catch (err) {
      showToast(errorMessage(err, 'Could not update this report'), 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader title="Bug report" />

      {reports.length === 0 ? (
        <EmptyState icon={<MessageSquare size={32} />} title="No reports yet" />
      ) : (
        <>
          <div className="mb-4">
            <FilterTabs tabs={tabs} value={status} onChange={setStatus} label="Feedback status" />
          </div>

          <div className="mb-4">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by name, role or text" />
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={<MessageSquare size={32} />} title={`No ${status} reports`} />
          ) : (
            <Table maxHeight="none">
              <THead>
                <TR>
                  <TH>From</TH>
                  <TH>Role</TH>
                  <TH>Type</TH>
                  <TH>Message</TH>
                  <TH>Page</TH>
                  <TH>Sent</TH>
                  <TH>Status</TH>
                  <TH>Action</TH>
                </TR>
              </THead>
              <TBody>
                {visible.map((report) => (
                  <TR key={report.id}>
                    <TD className="font-medium">{report.reporter_name || '—'}</TD>
                    <TD className="cell-secondary capitalize">{report.reporter_role || '—'}</TD>
                    <TD className="cell-secondary">{report.kind === 'bug' ? 'Bug' : 'Request'}</TD>
                    <TD className="feedback-message">{report.message}</TD>
                    <TD className="cell-muted font-mono">{report.page || '—'}</TD>
                    <TD className="cell-muted">{formatDate(report.created_at)}</TD>
                    <TD><StatusPill kind="feedback" value={report.status} /></TD>
                    <TD>
                      <Button
                        size="sm"
                        variant="outline"
                        className="action-button-compact"
                        loading={busy === report.id}
                        onClick={() => move(report, report.status === 'open' ? 'resolved' : 'open')}
                      >
                        {report.status === 'open' ? <Check size={14} /> : <RotateCcw size={14} />}
                        {report.status === 'open' ? 'Resolve' : 'Reopen'}
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
