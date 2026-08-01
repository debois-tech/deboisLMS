# UI Fixes & Feature Requests (cross-checked against current code)

> All file:line references are accurate as of this writing. Read the referenced code before
> changing anything. Line numbers drift as files change — re-verify with a search if unsure.

## Global note — shared components / duplicated code

Several of these issues touch code that is **duplicated in two files** (Batch Detail Finance tab and the
standalone Finance page). Fixes must be applied in BOTH places:

- `src/pages/batches/BatchDetailPage.tsx` — `FinanceTab` (Payment Log modal + Per-Student Fees table)
- `src/pages/fees/FeesPage.tsx` — standalone Finance page (same Payment Log modal + Per-Student Fees table)

If convenient, extract the duplicated modal/table into a shared component (e.g. `src/components/finance/PaymentLogModal.tsx`)
so both pages reuse it — but the minimum requirement is that both files end up identical in behavior/layout.

---

## 1. Modal placement bug: pop-up "flows below the screen" / pushed down

Affects at least: **Add Student modal** (Batch Detail → Students tab) and **Payment Log modal**
(Batch Detail → Finance tab and Fees page). Root cause is shared — fix it once in the `Modal` component.

### Current state

- `src/components/ui/Modal.tsx` renders the overlay as `fixed inset-0 z-50 flex items-center justify-center p-4`
  (line 35). `.modal-panel` caps height at `min(90vh, 52rem)` and `.modal-body` scrolls internally
  (`src/globals.css` lines 358–380) — so the panel itself is fine.
- `src/layouts/DashboardLayout.tsx` line 39: `<main className="app-content animate-fade-in">`.
- `fadeIn` keyframes (`src/globals.css` lines 473–476) animate `transform: translateY(10px) → translateY(0)`,
  and the class uses `forwards` fill (line 505), so `.app-content` **keeps** `transform: translateY(0)` forever.

### Root cause

A non-`none` computed `transform` on an ancestor turns it into a **containing block for `position: fixed`
descendants**. Because `.app-content` permanently holds `transform: translateY(0)`, the modal's `fixed inset-0`
is resolved against `.app-content` (the full page content area) instead of the viewport. The modal is therefore
vertically centered inside the whole scrollable page — so when the page is tall (a long student list, a long fee
table), the modal centers below the visible viewport and looks "pushed down off-screen".

This matches the reported behavior exactly: the Add Student modal looks fine on a short/empty page but breaks
once students are listed, and the Payment Log modal breaks the same way.

### Desired outcome / fix (pick one, portal is preferred)

1. **Render the `Modal` (and `ConfirmModal`) through a React portal into `document.body`** — the standard,
   robust fix. Create the portal in `src/components/ui/Modal.tsx` (e.g. `createPortal(<overlay/>, document.body)`).
   This permanently decouples modals from any ancestor transform/filter.
2. Alternative (less robust): change `fadeIn` to animate **opacity only** (no `transform`), and/or drop the
   `forwards` fill from `.animate-fade-in` so `.app-content` never retains a transform.

Verify: open the Add Student modal with a long student list, and the Payment Log modal, on both Batch Detail and
Fees page — modal must be vertically centered in the viewport and its body scrollable.

Note: the `StudentMultiSelect` dropdown inside the Add Student modal is `absolute` (not `fixed`) and will be
clipped by the scrollable `.modal-body` — that is existing behavior, not part of this bug; don't "fix" it.

---

## 2. Remove "Update Total" everywhere

There are currently **three** ways to edit a fee total; remove all of them. The only way to change money owed
should be via "Log Payment" (which adds to `paid_amount`). No UI may edit `total_fee` directly.

### Current state (all to remove)

Batch Detail (`src/pages/batches/BatchDetailPage.tsx`, `FinanceTab`):
- "Update Total" button in the Action column — lines 640–642.
- Inline edit row triggered by it — lines 616–624 (`editingId === fee.id` swaps the Total Fee cell for an
  input + check/X icons). This whole branch dies with the button.
- `handleSavePayment` — lines 547–553; `editingId` / `editValue` state — lines 531–532.
- `updateFeeTotal` import — line 22.

Finance page (`src/pages/fees/FeesPage.tsx`):
- "Update Total" button — lines 139–141.
- "Update Payment" modal — lines 153–162; `editingFee` state — line 23; `handleSavePayment` — lines 45–51.
- `updateFeeTotal` import — line 12.

Library layer:
- `updateFeeTotal` in `src/lib/supabase/queries/fees.ts` (line 46) and its re-export in
  `src/lib/supabase/index.ts` (line 8). After removing all UI usage, delete the function and its export too
  (grep confirms only these two pages import it).

### Desired outcome

- No "Update Total" button, no inline edit input/check/x, no "Update Payment" modal anywhere.
- The fee row Actions column keeps only "Log Payment".
- Do NOT touch `addFeePaymentLog` / `getFeesByBatch` / `getFeePaymentLogs` — those stay.

---

## 3. Payment Log modal — fix internal layout/spacing ("text and boxes close to each other, looks weird")

### Current state

Same markup duplicated in `BatchDetailPage.tsx` lines 653–727 and `FeesPage.tsx` lines 164–238. Structure:

- Summary stat row: `grid grid-cols-1 gap-3 sm:grid-cols-3`, three boxes with `p-4` (Student / Paid / Remaining).
- Form: `grid grid-cols-1 gap-4 sm:grid-cols-2` (Amount + Payment Date), then Payment Method `<select>`, then
  Notes `<textarea>`, then a right-aligned "Add Log" button, then a "Previous Payments" heading + scrollable
  `Table maxHeight="16rem"`.
- `.field` (label→input gap) is `0.375rem` (`src/globals.css` lines 181–185); modal body padding is
  `1rem 1.75rem 1.75rem` (`globals.css` line 374).

### Desired outcome

Clean, comfortable spacing consistent with the rest of the app (check `THEME.md` for tokens). At minimum:
- Comfortable gap between each label and its input (don't shrink `.field` globally — override/gap within this
  modal if needed).
- Consistent padding around the three summary stat boxes and clear vertical rhythm (`space-y-*`) between the
  stat row, the form, the "Add Log" button, and the "Previous Payments" section.
- Make sure the "Add Log" button isn't jammed against the "Previous Payments" heading.
- Fix BOTH files (or extract the shared component per the global note above).

---

## 4. Student Detail page — NEW "Overview" card (current batch, total payment, next lecture)

File: `src/pages/students/StudentDetailPage.tsx`. Currently the page has only the profile header `Card` and a
"Batch History" `Card` (lines 44–96). Add a new `Card` between the profile header and "Batch History".

### What to show

1. **Current batch** — the batch whose `batch_student_mapping.status === 'active'`. Display batch name (+ status
   badge, clickable to `/batches/:batchId`). The page already fetches mappings + batch for each
   (`getStudentBatches` + `getBatchById`, lines 22–33). If the student has **multiple** active batches, pick the
   one with the most recent `joined_at` (and document this choice in a code comment). If no active batch exists,
   fall back to "Not enrolled in any batch" (the existing empty Batch History covers this case).
2. **Total payment** — for the current batch, from the `student_fees` row for `(student_id, batch_id)`: show
   `total_fee`, `paid_amount`, and outstanding (`total_fee - paid_amount`), formatted with
   `formatCurrency` from `src/lib/utils/format.ts`. If `total_fee` is 0 that's a valid state (fee rows are
   auto-created with 0) — just show ₹0.
3. **Next upcoming lecture** — among the current batch's lectures
   (`getLecturesByBatch(currentBatchId)`, already sorted `lecture_date desc`), find the first with
   `lecture_date >= today`. **`lecture_date` is a date-only string (`YYYY-MM-DD`)** — compare date portions so
   today's own lecture counts as "upcoming". Show `formatDate(lecture_date)` (+ `session_type` / `meeting_code`
   if present). If there is no such lecture (none at all, or all in the past), show exactly:
   **"Caught up with all lectures"**.

### Data/queries needed

- Add `getFeesByStudent(studentId: string): Promise<StudentFee[]>` to `src/lib/supabase/queries/fees.ts`
  (select `*` where `student_id`, order `updated_at desc`), re-exported from `src/lib/supabase/index.ts`.
  Match the row to the current batch via `StudentFee.batch_id`. (Alternative without a new query:
  `getFeesByBatch(currentBatchId)` then find by `student_id` — but it auto-creates empty fee rows, prefer the
  dedicated query.)
- `getLecturesByBatch` already exists (`src/lib/supabase/queries/lectures.ts`); filter client-side for the
  next upcoming one. No new lecture query needed.
- Reuse existing card patterns — e.g. the `grid grid-cols-1 md:grid-cols-3` + `Card padding="sm"` layout from
  `OverviewTab` in `BatchDetailPage.tsx` (lines 120–135), or `StatCard`
  (`src/components/ui/StatCard.tsx`).

---

## 5. Student Detail page — NEW "Payment Logs" card at the bottom

File: `src/pages/students/StudentDetailPage.tsx`. Add a `Card` at the very bottom (after "Batch History").

### What to show

- All `fee_payment_logs` rows for this student, newest first: **Amount** (`formatCurrency`),
  **Date** (`payment_date`), **Method** (`payment_method`, display human-readable: `bank_transfer` →
  "bank transfer"), **Notes** (`notes` or "—").
- Because a student can have logs across multiple batches, include a **Batch** column (batch name) so rows are
  not confusing. Resolve names by joining `batches(name)` in the new query, or by fetching `getBatches()` and
  mapping client-side.
- If there are no logs, show the existing `EmptyState` pattern ("No payment logs yet").

### Data/queries needed

- Add `getFeePaymentLogsByStudent(studentId: string): Promise<FeePaymentLog[]>` to
  `src/lib/supabase/queries/fees.ts` (select where `student_id`, order `payment_date desc`), re-exported from
  `src/lib/supabase/index.ts`. `fee_payment_logs` already has `student_id`, `batch_id`, `payment_method`,
  `notes`, `created_at` (`supabase/schema.sql` lines 172–182) — no schema change required.
- This card is **read-only** (viewing history); no add/edit UI here.

---

## 6. Finance tables — clicking a student's name navigates to the student's detail page

### Current state

- Batch Detail FinanceTab: `src/pages/batches/BatchDetailPage.tsx` line 614 —
  `<TD className="font-medium">{student?.name ?? 'Unknown'}</TD>`.
- Finance page: `src/pages/fees/FeesPage.tsx` line 125 — same markup.
- Route already exists: `/students/:studentId` → `StudentDetailPage` (`src/App.tsx` line 33).

### Desired outcome

- In BOTH "Per-Student Fees" tables, the student name cell becomes a link to
  `` /students/${fee.student_id} ``. Use `fee.student_id` (the `student` object also carries `id` from
  `getBatchStudents`). Style it as a normal link with hover (e.g. `text-[var(--text-primary)]
  hover:text-[var(--text-primary)] hover:underline`, or match other in-table links).
- This ties into items 4 & 5: the destination page is where the student's fee status + payment logs now live.
- `BatchDetailPage.tsx` already imports `Link` (line 2). `FeesPage.tsx` does NOT — add
  `import { Link } from 'react-router-dom';`.
