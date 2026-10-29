# User Route Structure

## Layouts
- `/user/layout.tsx` — wraps all user pages
- `/user/journal/layout.tsx` — journal section
- `/user/analysis/layout.tsx` — analysis section

## Main Pages
- `/user/dashboard`
- `/user/profile`
- `/user/settings`
- `/user/settings/profile`
- `/user/settings/security`
- `/user/notifications`
- `/user/feedback`

## Journal
- `/user/journal` — overview
- `/user/journal/[journalId]` — details
- `/user/journal/diary`
- `/user/journal/gallery`
- `/user/journal/media-upload`

## Analysis
- `/user/analysis` — overview
- `/user/analysis/entries`
- `/user/analysis/audio`
- `/user/analysis/sentiment`
- `/user/analysis/voice`
- `/user/analysis/advanced`

## Error/Loading Boundaries
- `/user/journal/error.tsx`, `/user/journal/loading.tsx`
- `/user/analysis/error.tsx`, `/user/analysis/loading.tsx`

## Notes
- Use kebab-case for folders and URLs.
- Add new features as subfolders under the relevant section.
- Update navigation to match this structure.
