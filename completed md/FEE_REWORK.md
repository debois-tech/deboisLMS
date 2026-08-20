# Fee rework — termination, void, earning breakdown

Rules agreed 2026-08-19. Tick each box as it lands.

## Fee schedule

| What | When | Notes |
|---|---|---|
| Registration | at registration | ₹1000, compulsory, auto-logged by trigger. Never outstanding. |
| Installment 1 | batch start + 15d | was 20d |
| Installment 2 | batch start + 30d | was 40d |
| Installment 3 | batch start + 40d | unofficial. Never labelled "3" to the student. |

Installments 1 and 2: card stays green, turns to a "due in X days" countdown for the
last 3 days, red once missed. Installment 3: card is red from the moment a balance
survives installment 2, and picks the countdown back up at the 40-day mark.

More than 3 payments is fine. The student never sees a count above 2.

## Terminated students

The whole remaining balance leaves "pending due" — unenforceable, so it is never
counted as money we expect. It moves to **void**. If a void amount is later paid,
in part or in full, it lands in "fees collected" as earning. Pending due and fees
collected therefore stop mirroring each other, by design.

Instalments are flexible: 6k then 4k settles the same 10k as 5k twice, and a
leaver asked for 5k may settle at 4k by agreement. Nobody pays past the total —
for a leaver that total is `expected_on_exit`, since the instalments they never
reached no longer exist.

Five stored numbers, everything else derives:

| Figure | From |
|---|---|
| Contracted | `student_fees.total_fee` (no longer overwritten) |
| Owed at exit | `student_fees.expected_on_exit` (frozen at termination) |
| Collected | `student_fees.paid_amount` |
| Void | `max(expected_on_exit - paid_amount, 0)` |
| Never became due | `total_fee - expected_on_exit` |
| Recovered since exit | `max(paid_amount - paid_at_exit, 0)` |

## Tasks

### SQL — one migration, `supabase/migration_2026_08_19.sql`

- [x] `batch_student_mapping.left_on date` — termination date, currently thrown away
- [x] `student_fees.expected_on_exit numeric` — rule frozen at exit, and the
      ceiling on any later payment
- [x] `student_fees.paid_at_exit numeric` — what was paid that day, so void
      recovered since is a real figure
- [x] `record_fee_payment` — refuses a payment past what is owed, which the
      payment modal's comment had always claimed it did
- [x] Rewrite `terminate_enrolment`: 15/30 schedule, record both new columns,
      stop overwriting `total_fee`, delete the fabricated settlement payment log
- [x] `batch_fee_summary` — collected counts everyone, outstanding skips leavers
- [x] `earning_breakdown` view — collected (all students) / pending (active only) /
      void (terminated only), per batch
- [x] `student_fee_dues.paid_through` — milestone count decided by amount, so the
      portal can stop counting payment logs without seeing the totals
- [x] `delete_fee_payment` RPC — remove a log and decrement `paid_amount`.
      Reverts to pending or void automatically since both derive from `paid_amount`.
      Registration log is not deletable.

### Frontend

- [x] Types for the new columns, view and RPC
- [x] `installments.ts` — 15/30/40 table; drive off amount, not log count
      (3 logs used to kill the reminder even with money owed)
- [x] Portal home — balance card red once actually behind, green while on schedule
- [x] Dashboard — 6th card "Earning breakdown →" in the empty grid slot;
      Fees Collected and Pending Due cards open the same popup
- [x] Earning breakdown popup — totals + per-batch, batch chosen from a dropdown
      rather than an endless scroll
- [x] Delete-log control in the payment log modal, with confirm
- [x] Payment modal reads Void, not Remaining, for a student who left, and caps
      at it

## Deploy

Paste `supabase/migration_2026_08_19.sql` into the Supabase SQL editor and run it.
Re-runnable. Nothing to backfill — no student has been terminated yet.
