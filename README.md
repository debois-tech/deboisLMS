# Deboistech LMS

A full-stack Learning Management System built with **Next.js (App Router)** and **Supabase**.

## Overview

Deboistech LMS enables admins to create classes, upload study materials, create assignments and tests, and manage students. Students can join classes via a unique code, access materials, submit assignments, and take tests.

## Tech Stack

- **Frontend:** Next.js (App Router), CSS Modules
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Auth:** Supabase Auth (email/password)
- **Storage:** Supabase Storage (study materials, submissions, avatars)

## User Roles

- **Admin** — creates/manages classes, content, and grades submissions
- **Student** — joins classes via code, views materials, submits work, takes tests

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables (see env example below)
# Start development server
pnpm run dev
```

### Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_SETUP_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Project Structure

```
app/          — Next.js App Router pages (public, student, admin routes)
components/   — UI, layout, and feature components
lib/          — Supabase clients, utilities, types
styles/       — Global CSS, design tokens
```

## Features (V1)

- Admin & student authentication
- Class creation with unique join codes (`XXX-XXXX`)
- Study materials (documents, links, rich text)
- Assignments with due dates, file submission, and grading
- Tests with MCQ (auto-graded) and short answer questions
- Role-based access control with Supabase RLS
- Dark/light mode
- Responsive design

## Documentation

See [`deboistech_lms_docs.md`](./deboistech_lms_docs.md) for the full product specification, database schema, RLS policies, and route map.
