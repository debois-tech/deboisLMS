import { useEffect, useState } from 'react';
import { CalendarCheck, CalendarX } from 'lucide-react';
import {
  PortalEmpty,
  PortalList,
  PortalPage,
  PortalRow,
  PortalSection,
  PortalStat,
  PortalStatGrid,
  PortalStatus,
  usePortalStudentId,
} from '@/components/portal';
import { getApprovedAttendanceByStudent } from '@/lib/supabase';
import type { AttendanceRecord } from '@/lib/types';
import { formatDayLabel } from '@/lib/utils/format';

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
  const missed = records.length - attended;
  const rate = records.length > 0 ? Math.round((attended / records.length) * 100) : null;

  return (
    <PortalPage title="Your attendance" loading={loading}>
      {records.length === 0 ? (
        <PortalEmpty icon={CalendarCheck}>
          No classes counted yet. They appear once your teacher marks them.
        </PortalEmpty>
      ) : (
        <>
          <PortalStatGrid>
            <PortalStat
              label="Attendance"
              icon={CalendarCheck}
              value={`${rate}%`}
              tone={rate !== null && rate >= 75 ? 'positive' : 'attention'}
              progress={rate ?? undefined}
              note={`${attended} of ${records.length} classes`}
            />
            <PortalStat
              label="Missed"
              icon={CalendarX}
              value={missed === 0 ? 'None' : `${missed} ${missed === 1 ? 'class' : 'classes'}`}
              tone={missed === 0 ? 'positive' : 'default'}
            />
          </PortalStatGrid>

          <PortalSection title="Every class">
            <PortalList>
              {records.map((record) => (
                <PortalRow
                  key={record.id}
                  primary={record.lecture ? formatDayLabel(record.lecture.lecture_date) : 'Class'}
                  secondary={
                    record.total_attended_minutes != null
                      ? `${Math.round(Number(record.total_attended_minutes))} min`
                      : undefined
                  }
                  muted={record.status === 'present'}
                  trailing={<PortalStatus kind="attendance" value={record.status} />}
                />
              ))}
            </PortalList>
          </PortalSection>
        </>
      )}
    </PortalPage>
  );
}
