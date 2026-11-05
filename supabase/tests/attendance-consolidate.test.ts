// Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consolidateByStudent, fillRoster, splitProtected } from '../../src/lib/attendance/consolidate.ts';

const person = (studentId: string, displayName: string, totalMinutes: number, ids: string[]) => ({
  studentId,
  displayName,
  totalMinutes,
  rawUploadIds: ids,
});

test('two names matching one student become a single participant', () => {
  const { merged, collapsed } = consolidateByStudent(
    [person('s1', 'Temp Student', 50, ['a']), person('s1', 'Temp Studnt', 40, ['b']), person('s2', 'Dummy test 1', 30, ['c'])],
    120,
  );

  assert.equal(merged.length, 2);
  const s1 = merged.find((m) => m.studentId === 's1')!;
  assert.equal(s1.totalMinutes, 90);
  assert.deepEqual(s1.rawUploadIds, ['a', 'b']);
  assert.deepEqual(collapsed, ['Temp Studnt']);
});

test('summed minutes are capped at the scheduled length', () => {
  const { merged } = consolidateByStudent([person('s1', 'A', 100, ['a']), person('s1', 'A2', 100, ['b'])], 120);
  assert.equal(merged[0].totalMinutes, 120);
});

test('consolidating does not mutate the input', () => {
  const input = [person('s1', 'A', 10, ['a']), person('s1', 'A2', 10, ['b'])];
  consolidateByStudent(input, 120);
  assert.deepEqual(input[0].rawUploadIds, ['a']);
  assert.equal(input[0].totalMinutes, 10);
});

test('distinct students are left alone', () => {
  const { merged, collapsed } = consolidateByStudent([person('s1', 'A', 10, ['a']), person('s2', 'B', 20, ['b'])], 120);
  assert.equal(merged.length, 2);
  assert.deepEqual(collapsed, []);
});

test('hand-entered records are kept, automated ones are rewritten', () => {
  const payloads = [{ student_id: 'manual' }, { student_id: 'auto' }, { student_id: 'new' }];
  const { toWrite, kept } = splitProtected(payloads, [
    { student_id: 'manual', source: 'manual' },
    { student_id: 'auto', source: 'automated' },
  ]);

  assert.deepEqual(kept.map((p) => p.student_id), ['manual']);
  assert.deepEqual(toWrite.map((p) => p.student_id), ['auto', 'new']);
});

test('with nothing on file every payload is written', () => {
  const { toWrite, kept } = splitProtected([{ student_id: 'a' }], []);
  assert.equal(toWrite.length, 1);
  assert.equal(kept.length, 0);
});

test('roster students the file missed are Absent, or N/A before they joined', () => {
  const roster = [
    { studentId: 'here', joinedAt: '2026-10-01' },
    { studentId: 'gone', joinedAt: '2026-10-01' },
    { studentId: 'late', joinedAt: '2026-10-20' },
    { studentId: 'nodate', joinedAt: null },
  ];
  const fills = fillRoster(roster, new Set(['here']), '2026-10-10');

  assert.deepEqual(fills.map((f) => [f.studentId, f.status, f.minutes]), [
    ['gone', 'absent', 0],
    ['late', 'no_appli', null],
    ['nodate', 'absent', 0],
  ]);
});
