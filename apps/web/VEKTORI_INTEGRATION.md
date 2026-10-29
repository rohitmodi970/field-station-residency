# Vektori Integration Guide

This document explains how Vektori memory works in the Force web app, how to operate it locally, how to deploy it in production, and how to demo it to clients.

---

## Overview

Vektori is a **memory layer** that indexes journal entries and makes them retrievable for AI features. It runs alongside (not instead of) the existing `user_knowledge` legacy memory path.

```text
Journal save ──► background ingest ──► Vektori service
Chat / AI todo / Journal analyze ──► search Vektori ──► inject context into LLM prompt
                                      └─ fallback ──► legacy user_knowledge
```

### What gets memory?

| Feature | Uses Vektori? | Fallback |
|---------|---------------|----------|
| Chat (`/api/chat`) | Yes | Legacy `user_knowledge` |
| Journal analysis (`/api/journal/[id]/analyze`) | Yes | Legacy knowledge |
| AI todo generation (`/api/ai-todo`) | Yes | Continues without memory |
| New journal create/update | Ingests automatically | N/A |

---

## Architecture

### Core files

| File | Purpose |
|------|---------|
| `utils/vektori/client.ts` | Adapter: ingest, search, clear, health, metrics |
| `utils/vektori/config.js` | Env parsing, rollout bucketing, headers |
| `utils/vektori/payload.js` | Builds journal messages for ingest |
| `app/api/vektori/health/route.ts` | Runtime + upstream health |
| `app/api/vektori/search/route.ts` | User-scoped memory search |
| `app/api/vektori/backfill/route.ts` | Batch ingest for existing journals |
| `app/api/vektori/privacy/route.ts` | Opt-in/out and clear memory |
| `components/integrations/VektoriMemoryPanel.tsx` | Settings controls + diagnostics |
| `components/integrations/VektoriMemoryExplorer.tsx` | Live memory search UI |
| `components/integrations/VektoriBackfillButton.tsx` | One-click journal sync |
| `components/dashboard-b2c/VektoriSnapshot.tsx` | Dashboard health + explorer |
| `vektori_shim/main.py` | Local dev shim (mock or real Vektori) |
| `scripts/vektori-backfill.mjs` | Admin CLI backfill (all users, DB plaintext only) |

### Ingest payload

Each journal is ingested as:

- `user_id` — authenticated Supabase user ID
- `session_id` — `journal-<journal_id>`
- `messages` — `[{ role: 'user', content: '...' }]` built from title, content, mood, dates

Ingest runs in the **background** and never blocks journal saves.

### Retrieve payload

Search sends:

- `user_id`, `query`, `depth` (`l0` | `l1` | `l2`), `context_window`

Response is normalized into:

- `facts[]`, `episodes[]`, `sentences[]` — each with `text` and optional `score`

---

## Environment variables

Set these in `.env.local` (local) or your hosting provider (production):

```env
# Required to enable the adapter
VEKTORI_ENABLED=true
VEKTORI_BASE_URL=https://your-vektori-service.example.com

# Optional
VEKTORI_API_KEY=your-bearer-token
VEKTORI_ADD_PATH=/add
VEKTORI_SEARCH_PATH=/search
VEKTORI_HEALTH_PATH=/health
VEKTORI_CLEAR_PATH=/clear
VEKTORI_DEFAULT_DEPTH=l1
VEKTORI_ROLLOUT_PERCENT=100
VEKTORI_REQUEST_TIMEOUT_MS=5000
VEKTORI_FAILURE_THRESHOLD=3
VEKTORI_COOLDOWN_MS=120000
```

The adapter is **disabled** unless both `VEKTORI_ENABLED=true` and `VEKTORI_BASE_URL` are set.

---

## Local development

### 1. Start the Vektori shim

```powershell
cd apps/web
..\.venv\Scripts\python.exe -m uvicorn vektori_shim.main:app --host 127.0.0.1 --port 8787 --reload
```

Note the space between `main:app` and `--host` (a common typo breaks startup).

Verify:

```powershell
curl http://127.0.0.1:8787/health
```

### 2. Configure the web app

```env
VEKTORI_ENABLED=true
VEKTORI_BASE_URL=http://127.0.0.1:8787
VEKTORI_ROLLOUT_PERCENT=100
```

### 3. Start Next.js

```powershell
pnpm dev
```

### 4. Sync existing journals

**Option A — UI button (recommended)**

1. Log in and unlock encryption if prompted
2. Go to **Settings → Integrations**
3. Click **Sync existing journals to memory**
4. Wait for the progress bar to finish
5. Use **Memory Explorer** to search and verify

The UI button decrypts journals **client-side** (works with encrypted entries) and sends plaintext batches to `POST /api/vektori/backfill`.

**Option B — CLI script (admin, plaintext DB rows only)**

```powershell
cd apps/web
$env:VEKTORI_BASE_URL="http://127.0.0.1:8787"
pnpm vektori:backfill
```

This reads journals directly from Supabase. Encrypted-at-rest rows with empty `title`/`content` columns are **skipped**. Use the UI button for encrypted journals.

---

## Deploying to production

### Step 1: Deploy or connect a Vektori service

You need a reachable HTTP service exposing:

| Method | Path | Body / params |
|--------|------|---------------|
| `GET` | `/health` | — |
| `POST` | `/add` | `{ user_id, session_id?, messages[] }` |
| `POST` | `/search` | `{ user_id, query, depth?, context_window? }` |
| `POST` | `/clear` | `{ user_id, session_id?, scope? }` |

Options:

- **Vektori Cloud** — set `VEKTORI_BASE_URL` to your cloud endpoint and `VEKTORI_API_KEY`
- **Self-hosted Vektori** — deploy the service and point `VEKTORI_BASE_URL` at it
- **Shim on a VM** — run `vektori_shim/main.py` behind a reverse proxy (not recommended for production scale)

### Step 2: Set production env vars

On **Vercel**, **Railway**, **Fly.io**, or your host:

```env
VEKTORI_ENABLED=true
VEKTORI_BASE_URL=https://vektori.yourdomain.com
VEKTORI_API_KEY=<secret>
VEKTORI_ROLLOUT_PERCENT=100
```

Redeploy after changing env vars.

### Step 3: Run the database migration

Apply the memory controls migration if not already done:

```sql
-- apps/web/db/migrations/20260614_add_vektori_memory_controls.sql
alter table public.user_settings
  add column if not exists memory_opt_in boolean not null default true,
  add column if not exists memory_retention_days integer not null default 365,
  add column if not exists memory_rollout_percent integer not null default 100,
  add column if not exists memory_last_cleared_at timestamptz null;
```

### Step 4: Verify in production

1. Log into the deployed app
2. Open **Settings → Integrations** → click **Refresh** on diagnostics
3. Confirm **Service: Reachable** and **Enabled: Yes**
4. Write a test journal entry, then search in **Memory Explorer**
5. Open chat on a journal and confirm **Memory source: Vektori** on replies

### Step 5: Roll out gradually

Use per-user rollout in Settings (0 / 25 / 50 / 100%) or globally via `VEKTORI_ROLLOUT_PERCENT`. Rollout uses a stable hash of `user_id` so the same users stay in/out of the experiment.

---

## Using the memory layer in your deployed app

Once env vars are set and the service is reachable, memory works automatically — no code changes needed per feature.

### Automatic ingest (new entries)

Every journal **create** and **update** with plaintext content triggers background ingest when:

- `VEKTORI_ENABLED=true`
- User has `memory_opt_in !== false`
- User passes rollout bucket
- Content length > 20 characters

### Automatic retrieve (AI features)

These routes call `searchVektoriMemory()` before falling back:

- `POST /api/chat` — returns `memory_source: "vektori" | "legacy" | "none"`
- `POST /api/journal/[journalId]/analyze`
- `POST /api/ai-todo`

The chat UI shows the memory source badge on assistant replies.

### Manual operations (Settings UI)

| Action | Where | API |
|--------|-------|-----|
| Sync existing journals | Settings → Integrations | `POST /api/vektori/backfill` |
| Search memory | Dashboard or Settings | `POST /api/vektori/search` |
| Check health | Dashboard / Settings | `GET /api/vektori/health` |
| Opt in/out | Settings | `POST /api/vektori/privacy` |
| Clear memory | Settings | `POST /api/vektori/privacy` `{ action: "clear" }` |

### Programmatic usage (if extending the app)

```typescript
import { ingestVektoriMessages, searchVektoriMemory, formatVektoriContext } from '@/utils/vektori/client';

// Ingest
await ingestVektoriMessages({
  userId: 'user-uuid',
  sessionId: 'journal-abc123',
  messages: [{ role: 'user', content: 'Title: ...\nContent: ...' }],
});

// Search
const result = await searchVektoriMemory({
  userId: 'user-uuid',
  query: 'What are my goals?',
  depth: 'l1',
});

const contextBlock = formatVektoriContext(result);
// Inject contextBlock into your LLM system prompt
```

---

## Client demo script

### 1. Dashboard — Memory Layer (2 min)

Go to `/dashboard` → scroll to **Memory Layer**.

Show journal stats, health status (Live retrieval / Fallback), and signal bars.

### 2. Sync existing history (1 min)

**Settings → Integrations** → **Sync existing journals to memory**.

Explain: *"This indexes your full journal history, including encrypted entries decrypted in your browser."*

### 3. Memory Explorer (3 min)

Search for a known topic. Show **Facts**, **Episodes**, **Sentences** returned live.

### 4. Chat proof (5 min)

Open a journal → Force chatbot → ask something that requires memory.

Point to **Memory source: Vektori** on the reply.

### 5. Privacy controls (2 min)

Show opt-in toggle, rollout %, retention, and clear memory.

---

## Safety and fallback

- **5s request timeout** on all Vektori calls
- **Cooldown** after 3 consecutive failures (2 min default)
- **Legacy fallback** — chat and analysis continue if Vektori is down
- **Opt-out** — users can disable memory sync per account
- **Clear** — wipes Vektori memory and deactivates legacy `user_knowledge` rows

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Dashboard shows **Fallback** | Service down or env not set | Check `VEKTORI_ENABLED`, `VEKTORI_BASE_URL`, service `/health` |
| WinError 10013 on shim start | Port in use or typo in command | Kill process on port 8787; use `main:app --host` (with space) |
| Sync skips many journals | Encryption locked | Unlock encryption, retry sync |
| Search returns nothing | Not ingested yet | Run sync button or write a new entry |
| Chat shows **Legacy fallback** | Vektori search empty or down | Check health endpoint and ingest metrics |
| CLI backfill skips encrypted rows | Expected — DB has ciphertext only | Use the UI sync button instead |

---

## API reference

### `GET /api/vektori/health`

Returns `{ ok, runtime, metrics, service }`.

### `POST /api/vektori/search`

Body: `{ query: string, depth?: "l0"|"l1"|"l2" }`

Returns: `{ ok, source, facts[], episodes[], sentences[] }`

### `POST /api/vektori/backfill`

Body: `{ journals: [{ journalId, title, content, mood?, entryDate?, createdAt?, updatedAt? }] }`

Max 50 journals per request. Returns `{ ingested, skipped, failed, total }`.

### `GET /api/vektori/privacy`

Returns current memory lifecycle settings.

### `POST /api/vektori/privacy`

Body: `{ action: "opt_in" | "opt_out" | "clear" }`

---

## Encrypted journals note

Journals are encrypted at rest with client-side AES-256. The server-side CLI backfill script cannot read them. The **Sync existing journals** button decrypts in the browser (same as the journal list) and sends plaintext to the ingest API — this is the correct path for production users with encrypted history.
