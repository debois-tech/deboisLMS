# Deboistech LMS — Full Product Documentation

> **Purpose of this document:** This is a complete, implementation-ready specification for the Deboistech Learning Management System (LMS). It is written so that an AI coding assistant can build the entire product from this document alone — including database schema, auth flow, UI pages, and feature logic.

---

## 1. Project Overview

**Product Name:** Deboistech LMS  
**Type:** Web Application (Full-Stack)  
**Purpose:** An internal/external Learning Management System for Deboistech that allows admins to create classes, upload study material, create assignments and tests, and manage students — and allows students to join classes via a code, access materials, and submit work.

**Current Scope (V1):**
- ✅ Admin & Student authentication (Supabase Auth)
- ✅ Admin: Create and manage classes
- ✅ Admin: Generate unique class join codes
- ✅ Admin: Upload/post study material (documents, links, text)
- ✅ Admin: Create assignments with due dates
- ✅ Admin: Create tests (multiple choice / short answer questions)
- ✅ Student: Register and log in
- ✅ Student: Join a class using a code
- ✅ Student: View study material
- ✅ Student: Submit assignments
- ✅ Student: Take tests

**Out of Scope (V1):**
- ❌ Video hosting / streaming
- ❌ Real-time chat
- ❌ Payment / subscriptions
- ❌ Mobile app

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Next.js (App Router) | React-based, SSR/SSG support |
| **Styling** | Vanilla CSS or CSS Modules | No Tailwind unless explicitly requested |
| **Backend / API** | Supabase (PostgreSQL + Edge Functions) | Primary data layer |
| **Authentication** | Supabase Auth | Email/password for both roles |
| **Database** | Supabase PostgreSQL | With Row Level Security (RLS) |
| **File Storage** | Supabase Storage | For study material attachments (PDFs, docs) |
| **Hosting** | Vercel (frontend) + Supabase (backend) | Or Docker + Nginx |

---

## 3. User Roles

### 3.1 Admin
- A super-user created manually or via a protected registration route
- Can create, edit, and delete classes
- Can generate and regenerate class join codes
- Can create, edit, and delete study material, assignments, and tests
- Can view all enrolled students in their classes
- Can view student submissions and test results
- Cannot join classes as a student

### 3.2 Student
- Self-registers via the public sign-up page
- Joins classes using a class code provided by the admin
- Can view all content (study material, assignments, tests) in their enrolled classes
- Can submit assignments (text + file upload)
- Can take tests (one attempt only per test, unless reset by admin)
- Cannot create or edit any content

---

## 4. Database Schema (Supabase PostgreSQL)

> All tables use UUID primary keys. `created_at` timestamps are auto-set. RLS must be enabled on all tables.

---

### 4.1 `profiles` table
Extends Supabase's built-in `auth.users`. Created automatically via a database trigger on user sign-up.

```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'student')) DEFAULT 'student',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Trigger to auto-create profile on signup:**
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

### 4.2 `classes` table
```sql
CREATE TABLE classes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  subject      TEXT,
  admin_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  join_code    TEXT NOT NULL UNIQUE,   -- e.g. "DEB-4X9K"
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

**Join Code Format:** 8-character alphanumeric string (e.g. `DEB-4X9K`). Generated server-side, must be unique across all classes.

---

### 4.3 `class_enrollments` table
Tracks which students have joined which classes.

```sql
CREATE TABLE class_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);
```

---

### 4.4 `study_materials` table
```sql
CREATE TABLE study_materials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  type         TEXT NOT NULL CHECK (type IN ('document', 'link', 'text')),
  content      TEXT,        -- URL (for 'link'), rich text (for 'text'), or Supabase storage path (for 'document')
  file_name    TEXT,        -- original filename if type = 'document'
  file_size    BIGINT,      -- bytes
  created_by   UUID NOT NULL REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4.5 `assignments` table
```sql
CREATE TABLE assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,  -- instructions, rich text
  due_date      TIMESTAMPTZ,
  max_marks     INTEGER DEFAULT 100,
  allow_file    BOOLEAN DEFAULT TRUE,   -- allow file attachment in submission
  created_by    UUID NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4.6 `assignment_submissions` table
```sql
CREATE TABLE assignment_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text_answer     TEXT,
  file_path       TEXT,    -- Supabase storage path
  file_name       TEXT,
  marks_obtained  INTEGER,
  feedback        TEXT,    -- admin feedback after grading
  status          TEXT NOT NULL CHECK (status IN ('submitted', 'graded')) DEFAULT 'submitted',
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  graded_at       TIMESTAMPTZ,
  UNIQUE(assignment_id, student_id)
);
```

---

### 4.7 `tests` table
```sql
CREATE TABLE tests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  duration_mins INTEGER,        -- NULL = no time limit
  max_marks     INTEGER,        -- auto-calculated from questions if NULL
  is_published  BOOLEAN DEFAULT FALSE,  -- students can't see until published
  created_by    UUID NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4.8 `test_questions` table
```sql
CREATE TABLE test_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id         UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  question_type   TEXT NOT NULL CHECK (question_type IN ('mcq', 'short_answer')),
  options         JSONB,    -- Array of strings for MCQ: ["Option A", "Option B", ...]
  correct_answer  TEXT,     -- For MCQ: "Option A". For short_answer: model answer (admin ref only)
  marks           INTEGER NOT NULL DEFAULT 1,
  order_index     INTEGER NOT NULL DEFAULT 0   -- display order
);
```

---

### 4.9 `test_attempts` table
```sql
CREATE TABLE test_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id       UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answers       JSONB NOT NULL DEFAULT '{}',  -- { "question_id": "answer_text" }
  score         INTEGER,       -- auto-calculated for MCQ, manual for short_answer
  status        TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted')) DEFAULT 'in_progress',
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  submitted_at  TIMESTAMPTZ,
  UNIQUE(test_id, student_id)   -- one attempt per student per test
);
```

---

### 4.10 Row Level Security (RLS) Policies

Enable RLS on ALL tables. Key rules:

**`profiles`**
- Users can read their own profile
- Admins can read all profiles of students in their classes

**`classes`**
- Admins: full CRUD on classes they own (`admin_id = auth.uid()`)
- Students: can SELECT classes they are enrolled in

**`class_enrollments`**
- Students: can INSERT their own enrollment (joining a class)
- Students: can SELECT their own enrollments
- Admins: can SELECT all enrollments for their classes

**`study_materials`, `assignments`, `tests`, `test_questions`**
- Admins: full CRUD for content in their own classes
- Students: SELECT only, for classes they are enrolled in, and only published tests

**`assignment_submissions`**
- Students: INSERT and SELECT their own submissions
- Admins: SELECT and UPDATE (for grading) submissions in their classes

**`test_attempts`**
- Students: INSERT and SELECT their own attempts
- Admins: SELECT all attempts for their tests

---

## 5. Authentication Flow

### 5.1 Sign Up — Student
1. User visits `/auth/signup`
2. Fills in: Full Name, Email, Password
3. Role is hardcoded as `'student'` in `raw_user_meta_data`
4. Supabase creates `auth.users` entry → trigger creates `profiles` row
5. User is redirected to `/dashboard` (student view)

### 5.2 Sign Up — Admin
- Admin accounts are **not** self-service in V1
- Admin creates their account via a **protected route** `/auth/admin-setup` that requires a secret admin registration key (stored in env variable: `ADMIN_SETUP_KEY`)
- Or: Admin is created directly in the Supabase dashboard by manually setting `role = 'admin'` in the `profiles` table

### 5.3 Login — Both Roles
1. User visits `/auth/login`
2. Fills in: Email, Password
3. Supabase Auth validates credentials
4. On success: fetch the user's `profile` to get their `role`
5. Redirect:
   - `role === 'admin'` → `/admin/dashboard`
   - `role === 'student'` → `/dashboard`

### 5.4 Session Management
- Use Supabase's built-in session handling (`@supabase/auth-helpers-nextjs` or `@supabase/ssr`)
- Protect all `/admin/*` routes with middleware that checks `role === 'admin'`
- Protect all `/dashboard/*` routes by checking the user is authenticated

---

## 6. Application Pages & Routes

### 6.1 Public Pages

| Route | Page | Description |
|---|---|---|
| `/` | Landing Page | Marketing page — product intro, features, CTA to login/signup |
| `/auth/login` | Login | Email + password login for both roles |
| `/auth/signup` | Student Sign Up | Self-registration for students |
| `/auth/forgot-password` | Forgot Password | Supabase password reset flow |

---

### 6.2 Student Pages (`/dashboard/*`)

| Route | Page | Description |
|---|---|---|
| `/dashboard` | Student Home | Overview of enrolled classes, upcoming due dates |
| `/dashboard/join` | Join a Class | Enter class code to enroll |
| `/dashboard/classes` | My Classes | List of all joined classes |
| `/dashboard/classes/[classId]` | Class Home | Overview of a specific class: tabs for Materials, Assignments, Tests |
| `/dashboard/classes/[classId]/materials` | Study Materials | List and view all materials |
| `/dashboard/classes/[classId]/materials/[materialId]` | Material Detail | View/download a specific material |
| `/dashboard/classes/[classId]/assignments` | Assignments | List of assignments and submission status |
| `/dashboard/classes/[classId]/assignments/[assignmentId]` | Assignment Detail | View instructions and submit work |
| `/dashboard/classes/[classId]/tests` | Tests | List of available tests and attempt status |
| `/dashboard/classes/[classId]/tests/[testId]` | Take Test | Take the test (timed if applicable) |
| `/dashboard/classes/[classId]/tests/[testId]/result` | Test Result | View score and answers after submission |
| `/dashboard/profile` | My Profile | View/edit name, avatar |

---

### 6.3 Admin Pages (`/admin/*`)

| Route | Page | Description |
|---|---|---|
| `/admin/dashboard` | Admin Home | Stats: total classes, students, recent activity |
| `/admin/classes` | All Classes | List of all classes created by admin |
| `/admin/classes/new` | Create Class | Form to create a new class |
| `/admin/classes/[classId]` | Class Overview | Class details, tabs: Materials, Assignments, Tests, Students |
| `/admin/classes/[classId]/edit` | Edit Class | Edit class name, description, regenerate code |
| `/admin/classes/[classId]/students` | Enrolled Students | List of all students in this class |
| `/admin/classes/[classId]/materials` | Manage Materials | List materials, add/edit/delete |
| `/admin/classes/[classId]/materials/new` | Add Material | Form to add new material (type: doc/link/text) |
| `/admin/classes/[classId]/materials/[materialId]/edit` | Edit Material | Edit existing material |
| `/admin/classes/[classId]/assignments` | Manage Assignments | List assignments |
| `/admin/classes/[classId]/assignments/new` | Create Assignment | Form to create assignment with instructions and due date |
| `/admin/classes/[classId]/assignments/[assignmentId]` | Assignment Submissions | View all student submissions, grade them |
| `/admin/classes/[classId]/tests` | Manage Tests | List tests, publish/unpublish |
| `/admin/classes/[classId]/tests/new` | Create Test | Step 1: Test details. Step 2: Add questions |
| `/admin/classes/[classId]/tests/[testId]/edit` | Edit Test | Edit test or questions |
| `/admin/classes/[classId]/tests/[testId]/results` | Test Results | View all student scores and answers |

---

## 7. Feature Specifications

### 7.1 Class Code System

- **Format:** `XXX-XXXX` (3 letters + dash + 4 alphanumeric chars, e.g. `DEB-4X9K`)
- **Generation:** Random, server-side, checked for uniqueness in DB
- **Regeneration:** Admin can regenerate the code from the class settings (old code immediately invalidated)
- **Display:** Prominently shown on the class management page with a "Copy Code" button
- **Joining:** Student enters code on `/dashboard/join` → server looks up `classes` by `join_code` → inserts into `class_enrollments`
- **Error handling:** Show error if code is invalid, already joined, or class is inactive

---

### 7.2 Study Material

**Types:**
1. **Document** — Admin uploads a PDF or .docx file (stored in Supabase Storage bucket `study-materials`)
2. **Link** — Admin pastes an external URL (YouTube, Google Docs, website, etc.)
3. **Text** — Admin writes rich text directly in the platform (use a simple markdown/WYSIWYG editor)

**Student view:**
- Documents: download link or in-browser PDF preview
- Links: opens in new tab
- Text: rendered in-app

---

### 7.3 Assignments

**Creation (Admin):**
- Title, description (rich text with instructions)
- Due date (date/time picker)
- Max marks
- Toggle: allow file attachment or text-only submission

**Submission (Student):**
- Text area for written answer
- Optional: file upload (PDF, doc, image — max 10MB)
- Cannot re-submit after submission unless admin resets
- Shows submission status: Not Submitted / Submitted / Graded

**Grading (Admin):**
- View student's text answer and/or download their file
- Enter marks obtained
- Add written feedback
- Save → submission status changes to "graded"

---

### 7.4 Tests

**Creation (Admin) — 2-step flow:**

**Step 1: Test Setup**
- Title
- Description / instructions
- Duration in minutes (optional — if set, timer runs during student attempt)
- Auto-publish toggle

**Step 2: Add Questions**
- Add multiple questions
- Each question has:
  - Question text
  - Type: `MCQ` or `Short Answer`
  - For MCQ: 2–5 options, mark the correct answer
  - For Short Answer: optional model answer (only admin sees this)
  - Marks allocated
- Questions can be reordered (drag and drop ideally)
- Save as draft or publish

**Taking a Test (Student):**
- Only visible if test is published
- One attempt only (blocked after submission)
- If timer set: countdown shown, auto-submits on timeout
- MCQ: radio button selection
- Short Answer: text area
- "Submit Test" button with confirmation dialog

**Scoring:**
- MCQ answers: **auto-graded** on submission (compare to `correct_answer`)
- Short Answer: marks must be **manually entered** by admin
- Total score shown on result page (MCQ auto + short answer once graded)

---

## 8. UI/UX Guidelines

### 8.1 Design System
- **Theme:** Dark mode as default, with a toggle for light mode
- **Primary Color:** Deep blue/indigo (`#4F46E5`) with accent purple
- **Font:** `Inter` from Google Fonts (weights: 400, 500, 600, 700)
- **Aesthetics:** Glassmorphism cards, subtle gradients, smooth transitions
- **Radius:** `12px` for cards, `8px` for buttons/inputs
- **Shadows:** Soft, layered shadows — not harsh drop shadows

### 8.2 Component Library (Build Custom)
- `<Button>` — variants: primary, secondary, danger, ghost
- `<Card>` — standard content container with padding and border-radius
- `<Badge>` — status labels (e.g., "Submitted", "Graded", "Due Soon")
- `<Modal>` — for confirmations, quick forms
- `<Toast>` — success/error notifications (auto-dismiss)
- `<Tabs>` — for class page navigation (Materials / Assignments / Tests)
- `<CodeBlock>` — for displaying join codes with copy button
- `<EmptyState>` — illustrated empty state when no content exists
- `<Spinner>` — loading indicator

### 8.3 Responsive Design
- Mobile-first responsive layout
- Sidebar navigation collapses to bottom nav on mobile
- All forms and tables must work on small screens

---

## 9. Admin Dashboard — Key Widgets

The admin home page (`/admin/dashboard`) should show:

- **Total Classes** — count of active classes
- **Total Students** — unique enrolled students across all classes
- **Pending Grading** — count of ungraded assignment submissions
- **Recent Activity Feed** — last 5–10 actions (e.g., "Student X joined Class Y", "Assignment Z submitted")
- **Quick Actions** — buttons to "Create Class", "View Students"

---

## 10. Student Dashboard — Key Widgets

The student home page (`/dashboard`) should show:

- **My Classes** — grid of class cards (name, subject, number of members)
- **Upcoming Due Dates** — sorted list of assignment due dates across all classes
- **Recent Materials** — last 3 materials posted in enrolled classes
- **Join a Class** — prominent CTA card with code input field

---

## 11. Supabase Storage Configuration

### Buckets

| Bucket Name | Access | Purpose |
|---|---|---|
| `study-materials` | Private (signed URLs) | Study material document uploads by admins |
| `assignment-submissions` | Private (signed URLs) | Student assignment file submissions |
| `avatars` | Public | User profile pictures |

### File Rules
- Study materials: max 50MB, allowed types: PDF, DOCX, PPTX, XLSX, PNG, JPG
- Assignment submissions: max 10MB, allowed types: PDF, DOCX, TXT, PNG, JPG

---

## 12. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-only, never expose to client

# Admin Setup (for protected admin registration)
ADMIN_SETUP_KEY=your-secret-admin-setup-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 13. Project Folder Structure (Next.js App Router)

```
deboistech-lms/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                    # Landing page
│   │   └── auth/
│   │       ├── login/page.tsx
│   │       ├── signup/page.tsx
│   │       └── forgot-password/page.tsx
│   ├── (student)/
│   │   └── dashboard/
│   │       ├── page.tsx                # Student home
│   │       ├── join/page.tsx
│   │       ├── profile/page.tsx
│   │       └── classes/
│   │           └── [classId]/
│   │               ├── page.tsx
│   │               ├── materials/...
│   │               ├── assignments/...
│   │               └── tests/...
│   ├── (admin)/
│   │   └── admin/
│   │       ├── dashboard/page.tsx
│   │       └── classes/
│   │           ├── page.tsx
│   │           ├── new/page.tsx
│   │           └── [classId]/
│   │               ├── page.tsx
│   │               ├── edit/page.tsx
│   │               ├── students/page.tsx
│   │               ├── materials/...
│   │               ├── assignments/...
│   │               └── tests/...
│   ├── layout.tsx                      # Root layout
│   └── middleware.ts                   # Auth + role protection
├── components/
│   ├── ui/                             # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   ├── Tabs.tsx
│   │   ├── Spinner.tsx
│   │   └── EmptyState.tsx
│   ├── layout/
│   │   ├── AdminSidebar.tsx
│   │   ├── StudentSidebar.tsx
│   │   └── Navbar.tsx
│   └── features/
│       ├── classes/
│       ├── materials/
│       ├── assignments/
│       └── tests/
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Browser client
│   │   ├── server.ts                   # Server client
│   │   └── middleware.ts               # Middleware client
│   ├── utils/
│   │   ├── generate-code.ts            # Class code generator
│   │   └── format-date.ts
│   └── types/
│       └── database.ts                 # TypeScript types from Supabase schema
├── styles/
│   ├── globals.css
│   ├── tokens.css                      # Design tokens (colors, spacing, typography)
│   └── components.css
└── public/
    └── images/
```

---

## 14. Key Business Logic — Implementation Notes

### Generate Class Code
```typescript
// lib/utils/generate-code.ts
export function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusable chars (0/O, 1/I)
  const prefix = 'DEB';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}-${code}`;
}
// Must check DB for collision and retry if duplicate
```

### Join a Class (Student Action)
```typescript
// 1. Trim and uppercase the entered code
// 2. Query: SELECT id, name, is_active FROM classes WHERE join_code = $code
// 3. If not found → error: "Invalid class code"
// 4. If is_active = false → error: "This class is no longer active"
// 5. Check if already enrolled: SELECT id FROM class_enrollments WHERE class_id = $classId AND student_id = $userId
// 6. If exists → error: "You have already joined this class"
// 7. INSERT into class_enrollments → success: redirect to class page
```

### Auto-Grade MCQ Test on Submission
```typescript
// On test submission:
// 1. Fetch all questions for the test where question_type = 'mcq'
// 2. For each MCQ question, compare student's answer (from test_attempts.answers JSONB)
//    to correct_answer in test_questions
// 3. Sum marks for correct answers
// 4. UPDATE test_attempts SET score = totalScore, status = 'submitted', submitted_at = NOW()
// Note: Short answer marks must be added manually by admin later
```

---

## 15. Error Handling & Edge Cases

| Scenario | Expected Behavior |
|---|---|
| Student tries to access a class they haven't joined | Redirect to `/dashboard` with error toast |
| Student tries to re-submit an assignment | Show "Already submitted" state, no re-submit button |
| Student tries to take a test twice | Show result page directly |
| Admin tries to delete a class with enrollments | Confirm dialog: "This will remove all students and content. Confirm?" |
| Test timer runs out | Auto-submit the attempt with current answers |
| Student submits a test with unanswered questions | Warn dialog: "You have X unanswered questions. Submit anyway?" |
| File upload exceeds size limit | Show inline error before upload |
| Class code collision on generation | Server retries up to 5 times, then shows generic error |

---

## 16. Nice-to-Have Features (Future Scope / V2)

These are NOT in scope for V1 but should be architecturally easy to add:

- 📧 Email notifications (assignment due soon, new material posted)
- 📊 Detailed analytics for admins (average scores, completion rates)
- 🎥 Video lesson support (Cloudflare Stream or Mux integration)
- 💬 Class announcement/discussion board
- 🏆 Student progress tracking (% course completion)
- 📱 PWA (Progressive Web App) support
- 🔁 Multiple test attempts (with admin setting)
- 📤 Bulk student CSV import

---

## 17. Deliverables Checklist for the Developer

When the LMS is complete, the following should be verified:

- [ ] Admin can sign up via protected route and log in
- [ ] Student can self-register and log in
- [ ] Admin can create a class and see the generated code
- [ ] Student can join a class using the code
- [ ] Admin can post study materials (all 3 types: doc, link, text)
- [ ] Student can view and download study materials
- [ ] Admin can create an assignment with a due date
- [ ] Student can submit an assignment (text + file)
- [ ] Admin can grade a submission and leave feedback
- [ ] Admin can create a test with MCQ and short answer questions
- [ ] Admin can publish a test
- [ ] Student can take the test (with optional timer)
- [ ] MCQ questions are auto-graded on submission
- [ ] Student can view their test result
- [ ] Admin can view all results for a test
- [ ] All routes are protected by role (no student can access `/admin/*`)
- [ ] RLS policies prevent cross-user data access
- [ ] App is responsive on mobile
- [ ] Dark/light mode toggle works

---

*Document Version: 1.0 | Created: July 2026 | Project: Deboistech LMS*
