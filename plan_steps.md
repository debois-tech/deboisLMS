# DeboisTech ERP — Implementation Plan

## Overview

Pivot from the existing LMS scaffold to a single-admin ERP dashboard for managing training batches (DevOps, AI/ML, etc.). Stack: React 19 + TypeScript + Vite 6 + Tailwind v4 + Supabase. Mock data layer isomorphic to the Supabase schema — swap in real API calls when Supabase is live.

---

## Phase 0 — Supabase Setup (YOU do this)

1. **Create Supabase project** at [supabase.com](https://supabase.com)
2. **Run `supabase/schema.sql`** in the Supabase SQL Editor — creates all tables, enums, indexes, and convenience views
3. **Create a single admin user** in Supabase Auth:
   - Go to **Authentication → Users → Add User**
   - Email: `admin@deboistech.com` (or your preferred admin email)
   - Password: set a strong password shared within the org
   - This is the **only** login — everyone in the org uses these same credentials
4. **Copy project credentials:**
   - Go to **Project Settings → API**
   - Copy `Project URL` (anon)
   - Copy `anon public` key
   - Paste both into `.env`:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

5. **Enable the table editor** and optionally add a few test rows manually to verify schema
6. **Let me know when Supabase is ready** — at that point we swap `lib/mock/` calls for `@supabase/supabase-js` queries

---

## Phase 1 — Project Cleanup (Me)

### 1a. Delete LMS-specific files

| Path | Reason |
|------|--------|
| `src/pages/` (entire directory) | All 24 pages are LMS-specific (classes, tests, assignments, grading) |
| `src/lib/mock/assignments.ts` | LMS assignment mock |
| `src/lib/mock/classes.ts` | LMS class mock |
| `src/lib/mock/dashboard.ts` | LMS dashboard stats mock |
| `src/lib/mock/materials.ts` | LMS study material mock |
| `src/lib/mock/tests.ts` | LMS test mock |
| `src/layouts/StudentLayout.tsx` | No student login |
| `src/components/layout/StudentSidebar.tsx` | No student login |

### 1b. Update types (`src/lib/types/index.ts`)
- **Remove:** `Class`, `ClassEnrollment`, `StudyMaterial`, `MaterialType`, `Assignment`, `AssignmentSubmission`, `SubmissionStatus`, `Test`, `TestQuestion`, `QuestionType`, `TestAttempt`, `AttemptStatus`, `AdminStats`, `ActivityItem`
- **Keep:** `Profile`, `Role`, `Toast`, `ToastVariant`, `NavItem`
- **Add:** `Batch`, `Student`, `Tutor`, `Lecture`, `UploadRow`, `AttendanceRecord`, `StudentFee`, `Assignment`, `AssignmentCompletion`, `BatchStudentMapping`, `TutorBatchMapping`, `BatchStatus`, `AttendanceStatus`, `MappingStatus`, `SubmissionChannel`, `BatchFeeSummary`, `BatchAttendanceSummary`
- **Collapse Role:** `type Role = 'admin'` (remove 'student')

### 1c. Update Auth (`src/lib/context/AuthContext.tsx`)
- Remove `isStudent` — only `isAdmin` matters
- Update `MOCK_SESSION` import to match new single-admin pattern

### 1d. Update mock auth (`src/lib/mock/auth.ts`)
- Remove student mock paths
- Default to a single `admin@deboistech.com` mock profile

### 1e. Rename + simplify layout
- `AdminSidebar.tsx` → `Sidebar.tsx` (single sidebar for the admin)
- `AdminLayout.tsx` → `DashboardLayout.tsx` (single layout shell)
- Remove `StudentLayout.tsx`
- Update `Navbar.tsx` — remove student-specific links, simplify user dropdown

---

## Phase 2 — New Mock Data Layer (Me)

Create 7 mock files isomorphic to the Supabase schema. Each exports async CRUD functions (e.g. `getBatches()`, `createBatch()`, `updateBatch()`, `deleteBatch()`) with realistic delays and in-memory stores.

### Mock files:

| File | Domain | Key Functions |
|------|--------|---------------|
| `lib/mock/data.ts` | **Seed data** | Shared in-memory arrays for all entities (so CRUD operations persist across mocks within a session) |
| `lib/mock/batches.ts` | Batches + mappings | `getBatches()`, `getBatchById()`, `createBatch()`, `updateBatch()`, `deleteBatch()`, `getBatchStudents()`, `getBatchTutors()` |
| `lib/mock/students.ts` | Students | `getStudents()`, `getStudentById()`, `createStudent()`, `updateStudent()`, `getStudentBatches()` |
| `lib/mock/tutors.ts` | Tutors | `getTutors()`, `getTutorById()`, `createTutor()`, `updateTutor()` |
| `lib/mock/lectures.ts` | Lectures | `getLecturesByBatch()`, `createLecture()`, `updateLecture()`, `deleteLecture()` |
| `lib/mock/attendance.ts` | Upload + Attendance | `getUploadsByLecture()`, `uploadCSVRows()`, `getAttendanceByLecture()`, `approveAttendance()`, `bulkApproveAttendance()` |
| `lib/mock/fees.ts` | Student Fees | `getFeesByBatch()`, `getFeeRecord()`, `updateFeePayment()`, `getBatchFeeSummary()` |
| `lib/mock/assignments.ts` | Assignments + Completion | `getAssignmentsByBatch()`, `createAssignment()`, `getCompletionByAssignment()`, `markSubmission()` |

### Seed data:
- 2–3 batches (e.g. "DevOps Batch 3", "AI/ML Batch 1", "DevOps Batch 2")
- 8–10 students across batches
- 2–3 tutors
- 5–6 lectures per batch
- Attendance records for a subset of lectures
- Fee records per student per batch
- 2–3 assignments per batch with mixed submission statuses

---

## Phase 3 — Pages & Routing (Me)

### 3a. App.tsx — New route structure

```tsx
<Routes>
  <Route path="/auth/login" element={<LoginPage />} />

  <Route path="/" element={<DashboardLayout />}>
    <Route index element={<DashboardPage />} />
    <Route path="batches" element={<BatchesPage />} />
    <Route path="batches/new" element={<NewBatchPage />} />
    <Route path="batches/:batchId" element={<BatchDetailPage />} />
    <Route path="batches/:batchId/edit" element={<EditBatchPage />} />
    <Route path="students" element={<StudentsPage />} />
    <Route path="students/new" element={<NewStudentPage />} />
    <Route path="students/:studentId" element={<StudentDetailPage />} />
    <Route path="tutors" element={<TutorsPage />} />
    <Route path="tutors/new" element={<NewTutorPage />} />
    <Route path="attendance" element={<AttendancePage />} />
    <Route path="fees" element={<FeesPage />} />
    <Route path="assignments" element={<AssignmentsPage />} />
  </Route>
</Routes>
```

### 3b. Sidebar navigation

```
Dashboard       → /
Batches         → /batches
Students        → /students
Tutors          → /tutors
Attendance      → /attendance
Finance         → /fees
Assignments     → /assignments
```

Bottom CTA button: "New Batch" (→ `/batches/new`)

### 3c. Pages to build

| Page | Description | Key Data |
|------|-------------|----------|
| **DashboardPage** | Overview KPIs — total batches, active students, pending attendance approvals, fee collection rate, recent activity feed | BatchFeeSummary, BatchAttendanceSummary, recent uploads |
| **BatchesPage** | Table of all batches with status badges, student count, progress indicators | batches[] |
| **NewBatchPage** | Form: name, track (DevOps/AI-ML dropdown), status, start date | createBatch() |
| **EditBatchPage** | Pre-filled edit form | updateBatch() |
| **BatchDetailPage** | Detail with tabs: Overview (stats), Students (table + add/remove), Tutors (table + assign), Lectures (list + add), Attendance (per-lecture table with approve toggle), Fees (per-student table with paid amount inline edit), Assignments (list + per-student completion grid) | batch + related entities |
| **StudentsPage** | Searchable table of all students, link to add | students[] |
| **NewStudentPage** | Form: name, phone, email, GitHub, LinkedIn, batch assignment | createStudent(), linkToBatch() |
| **StudentDetailPage** | Student profile + batch history (which batches, statuses) | studentById, getStudentBatches() |
| **TutorsPage** | Table of all tutors | tutors[] |
| **NewTutorPage** | Form: name, email, phone, batch assignments | createTutor(), assignToBatch() |
| **AttendancePage** | Two views: (1) **Uploads tab** — list raw CSV uploads per lecture, (2) **Final tab** — attendance records with approve/reject toggle per row or bulk per lecture | uploads[], attendance[] |
| **FeesPage** | Per-batch fee summary cards + expand to per-student breakdown, highlight outstanding balances | fee summary + per-student fees |
| **AssignmentsPage** | Per-batch assignment list + per-assignment completion grid showing each student's submission status | assignments[], completions[] |

---

## Phase 4 — UI Polish & Verification (Me)

- Verify all CRUD operations work through mock layer
- Verify responsive layout (mobile sidebar overlay, content reflow)
- Verify dark/light theme consistency across new pages
- Ensure empty states for every list (no data yet)
- Ensure loading states for every async operation
- Add error boundaries around each route
- Confirm no dead code, no LMS leftovers

---

## Phase 5 — Supabase Integration (Me, after you confirm Phase 0)

- Install `@supabase/supabase-js`
- Create `src/lib/supabase/client.ts` — initialize Supabase client from `.env`
- Create `src/lib/supabase/queries/` — one file per domain mirroring the mock API shape
- Swap each `import { getBatches } from '@/lib/mock/batches'` to `import { getBatches } from '@/lib/supabase/queries/batches'`
- Test each page against real Supabase data
- Remove mock files (or keep as fallback)