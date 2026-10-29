# Setup Guide (2026) - Better UI with GitHub Copilot

This is the Copilot-first version of the viral setup flow.

## What you are building
A professional, animated website UI using your existing Next.js app with:
- Framer Motion transitions
- Reusable UI blocks
- Clean visual hierarchy
- Full code ownership

## Good news for this repo
Your project already includes the key packages:
- framer-motion
- lucide-react
- class-variance-authority
- clsx
- tailwind-merge

No Claude Code setup is required.

## 4-step Copilot workflow

### 1) Open the web app folder
From workspace root:

```powershell
cd apps/web
```

### 2) Start dev server

```powershell
pnpm dev
```

### 3) Give Copilot one high-quality prompt
Use one prompt at a time in Copilot Chat so it can implement directly.

Prompt A (full page redesign):

```text
Redesign this page into a premium, animated, mobile-first layout. Keep existing business logic unchanged. Use Framer Motion for section reveals and transitions. Use a calm rose-sand-sage palette (not overly pink), strong typography hierarchy, and reusable components. Add expand/collapse for long card content. Preserve accessibility and responsive behavior.
```

Prompt B (component polish):

```text
Refactor this component for pro-level UI: improve spacing rhythm, typography hierarchy, color contrast, and loading/empty/error states. Keep behavior unchanged. Add subtle Framer Motion transitions and prevent overflow on small screens.
```

Prompt C (consistency pass):

```text
Do a consistency pass across dashboard, journal, and analysis pages: unify card styles, border radii, shadows, and section labels; reduce over-saturated pink tones; keep the existing visual brand calm and cohesive.
```

### 4) Add external UI blocks when needed
You can still use 21st.dev components in a Copilot workflow:
1. Copy the integration line from 21st.dev.
2. Paste it in terminal or Copilot chat.
3. Ask Copilot to adapt the generated component to your theme system.

Suggested follow-up prompt:

```text
Integrate this generated component into our existing design language. Match our theme tokens, typography, border radii, and animation style. Ensure dark mode and mobile responsiveness work.
```

## Fast quality checklist (2 minutes)
Before shipping any UI change, ask Copilot:

```text
Review this UI change for regressions. Focus on accessibility, responsiveness, long-text overflow, loading states, and visual consistency with existing dashboard/journal/analysis pages. Then fix issues directly.
```

## Pro tip for this repo
A repository-level instruction file is now added at:
- .github/copilot-instructions.md

This helps Copilot keep future UI work aligned with your preferred style automatically.
