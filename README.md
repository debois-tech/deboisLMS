# Deboistech LMS

A full-stack Learning Management System built with **Vite + React** and **Supabase**.

## Overview

Deboistech LMS enables admins to create classes, upload study materials, create assignments and tests, and manage students. Students can join classes via a unique code, access materials, submit assignments, and take tests.

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, React Router 7
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Auth:** Supabase Auth (email/password)
- **Storage:** Supabase Storage (study materials, submissions, avatars)
- **Build Tool:** Vite 6

## User Roles

- **Admin** — creates/manages classes, content, and grades submissions
- **Student** — joins classes via code, views materials, submits work, takes tests

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env   # or set up manually (see below)

# Start development server
npm run dev
```

### Required Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_SERVICE_ROLE_KEY=
VITE_ADMIN_SETUP_KEY=
```

## Project Structure

```
src/
├── components/   — Reusable UI components
├── layouts/      — Layout components
├── lib/          — Supabase clients, utilities, types
├── pages/        — Route pages (public, student, admin routes)
├── App.tsx       — Root component with router
├── main.tsx      — Entry point
└── globals.css   — Global styles (Tailwind)
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

See [`deboistech erp prd.md`](./deboistech%20erp%20prd.md) for the full product specification.
