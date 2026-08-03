import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { PortalEmpty, PortalPage, PortalRow, usePortalStudentId } from '@/components/portal/PortalPage';
import { getApprovedAttendanceByStudent } from '@/lib/supabase';
import type { AttendanceRecord, AttendanceStatus } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

const statusVariant: Record<AttendanceStatus, 'success' | 'warning' | 'danger'> = {
  present: 'success',
  partial: 'warning',
  absent: 'danger',
};

export default function PortalAttendancePage() {
  const studentId = usePortalStudentId();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    let active = true;
    getApprovedAttendanceByStudent(studentId).then((data) => {
      if (!active) return;
      setRecords(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [studentId]);

  const attended = records.filter((record) => record.status !== 'absent').length;

  return (
    <PortalPage
      title="Attendance"
      subtitle={
        records.length > 0
          ? `Present or partial for ${attended} of ${records.length} lectures`
          : 'Records appear here once a lecture is reviewed'
      }
      loading={loading}
    >
      {records.length === 0 ? (
        <PortalEmpty>No attendance records yet.</PortalEmpty>
      ) : (
        <div className="portal-list">
          {records.map((record) => (
            <PortalRow
              key={record.id}
              primary={record.lecture ? formatDate(record.lecture.lecture_date) : 'Lecture'}
              secondary={
                record.total_attended_minutes != null
                  ? `${Math.round(Number(record.total_attended_minutes))} min attended`
                  : undefined
              }
              trailing={<Badge variant={statusVariant[record.status]} dot>{record.status}</Badge>}
            />
          ))}
        </div>
      )}
    </PortalPage>
  );
}
