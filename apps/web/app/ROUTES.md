# ROUTES.md

## Overview
This document describes the new routing structure for the FORCE web application, following the migration to Next.js route groups and improved logical grouping for user convenience.

---

## Top-Level Routes
- `/` — Home (Landing)
- `/about`
- `/contact`
- `/terms-and-conditions`
- `/confirmation-page`
- `/error`

## Auth Routes
- `/auth/register`
- `/auth/onboarding`
- `/auth/error`

- `/auth/reset-password`
- `/auth/verify-email`

## User Grouped Routes (Next.js route group `(user)`)
- `/dashboard`
- `/profile`
- `/security`
- `/whats-next`
- `/ocr`
- `/assistant`
- `/settings`
  - `/settings/profile`
  - `/settings/devices`
- `/notifications`
- `/feedback`

## Journal Section
- `/journal`
- `/journal/journals`
- `/journal/[journalId]`
- `/journal/my-diary`
- `/journal/media-upload`
- `/journal/gallery`
- `/journal-entry`

## Analysis Section
- `/analysis`
- `/analysis/entries`
- `/analysis/voiceAnalysis`
- `/analysis/sentiment-analysis`
- `/analysis/advanced`

## Layouts
- `(user)/layout.tsx` — wraps all user-related pages
- `(user)/journal/layout.tsx` — wraps journal section
- `(user)/analysis/layout.tsx` — wraps analysis section
- `(auth)/layout.tsx` — wraps auth section
- `layout.tsx` — global app layout

---

## Notes
- All navigation and links have been updated to match this structure.
- API routes (e.g., `/api/user/profile`) remain unchanged for backend logic.
- Route groups are used for code organization, not affecting the public URL structure.

---

_Last updated: November 17, 2025_
