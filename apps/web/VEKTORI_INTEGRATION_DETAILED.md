# Vektori Integration

## What Was Built

The integration is not a single API call. It is a multi-layer memory system with all of the following pieces working together:

- Environment gating and rollout controls in [utils/vektori/config.js](utils/vektori/config.js#L14).
- A network adapter with health checks, ingest, search, clear, metrics, and fallback cooling logic in [utils/vektori/client.ts](utils/vektori/client.ts#L192).
- Journal payload shaping in [utils/vektori/payload.js](utils/vektori/payload.js#L1).
- Automatic ingestion on journal create/update in [app/api/journals/route.ts](app/api/journals/route.ts#L550) and [app/api/journals/route.ts](app/api/journals/route.ts#L750).
- Retrieval in chat, AI todo generation, and journal analysis in [app/api/chat/route.ts](app/api/chat/route.ts#L99), [app/api/ai-todo/route.ts](app/api/ai-todo/route.ts#L166), and [app/api/journal/[journalId]/analyze/route.ts](app/api/journal/[journalId]/analyze/route.ts#L626).
- A dedicated Vektori API layer for health, search, backfill, and privacy in [app/api/vektori/health/route.ts](app/api/vektori/health/route.ts#L5), [app/api/vektori/search/route.ts](app/api/vektori/search/route.ts#L89), [app/api/vektori/backfill/route.ts](app/api/vektori/backfill/route.ts#L34), and [app/api/vektori/privacy/route.ts](app/api/vektori/privacy/route.ts#L17).
- User-facing controls and diagnostics in [components/integrations/VektoriMemoryPanel.tsx](components/integrations/VektoriMemoryPanel.tsx#L50), [components/integrations/VektoriMemoryExplorer.tsx](components/integrations/VektoriMemoryExplorer.tsx#L47), [components/integrations/VektoriBackfillButton.tsx](components/integrations/VektoriBackfillButton.tsx#L121), and [components/dashboard-b2c/VektoriSnapshot.tsx](components/dashboard-b2c/VektoriSnapshot.tsx#L71).
- Local dev shim support in [vektori_shim/main.py](vektori_shim/main.py#L15) and [vektori_shim/README.md](vektori_shim/README.md#L1).
- Admin backfill tooling in [scripts/vektori-backfill.mjs](scripts/vektori-backfill.mjs#L1).
- A database migration for privacy and rollout fields in [db/migrations/20260614_add_vektori_memory_controls.sql](db/migrations/20260614_add_vektori_memory_controls.sql#L1).

## Executive Summary

Vektori is the memory engine that indexes journal content so downstream features can retrieve context instead of rebuilding everything from legacy `user_knowledge`. The key design choice is that Vektori is additive and fallback-safe: if it is disabled, misconfigured, or temporarily failing, the app still works through legacy memory and the rest of the product continues normally.

That means the integration had to touch:

- background journal write paths,
- search and prompt-building logic,
- opt-in / opt-out privacy controls,
- per-user rollout logic,
- health metrics and cooldown protection,
- client-side encrypted journal backfill,
- a local mock service for development,
- and several distinct UI surfaces.

## Runtime Gate And Rollout

The integration is controlled centrally in [utils/vektori/config.js](utils/vektori/config.js#L14). The config layer determines whether Vektori is enabled, what base URL to call, which endpoints to use, request timeout, failure thresholds, cooldown duration, and rollout percentage.

Representative snippet:

```js
export function getVektoriConfig(env = process.env) {
  const rolloutPercent = Number.parseInt(env.VEKTORI_ROLLOUT_PERCENT || '100', 10);
  return {
    enabled: env.VEKTORI_ENABLED === 'true' && Boolean(env.VEKTORI_BASE_URL),
    configured: Boolean(env.VEKTORI_BASE_URL),
    baseUrl: env.VEKTORI_BASE_URL || '',
    apiKey: env.VEKTORI_API_KEY || '',
    addPath: env.VEKTORI_ADD_PATH || '/add',
    searchPath: env.VEKTORI_SEARCH_PATH || '/search',
    healthPath: env.VEKTORI_HEALTH_PATH || '/health',
    clearPath: env.VEKTORI_CLEAR_PATH || '/clear',
    defaultDepth: env.VEKTORI_DEFAULT_DEPTH || 'l1',
    timeoutMs: Number.parseInt(env.VEKTORI_REQUEST_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10) || DEFAULT_TIMEOUT_MS,
    failureThreshold: Number.parseInt(env.VEKTORI_FAILURE_THRESHOLD || String(FAILURE_THRESHOLD), 10) || FAILURE_THRESHOLD,
    cooldownMs: Number.parseInt(env.VEKTORI_COOLDOWN_MS || String(COOLDOWN_MS), 10) || COOLDOWN_MS,
    rolloutPercent: Number.isFinite(rolloutPercent) ? Math.min(100, Math.max(0, rolloutPercent)) : 100,
  };
}
```

This also includes stable per-user rollout bucketing, which means the same user stays in or out of the experiment consistently instead of flipping randomly between requests.

## Adapter Layer

The adapter in [utils/vektori/client.ts](utils/vektori/client.ts#L192) is the core glue. It does four things that matter operationally:

- It performs a health check before the UI claims the service is healthy.
- It sends ingest/search/clear requests to the configured Vektori service.
- It normalizes search payloads into the app’s internal result shape.
- It tracks failures and enters a cooldown window after repeated errors.

Representative ingest/search/clear behavior:

```ts
export async function ingestVektoriMessages(params: VektoriIngestParams): Promise<boolean> {
  const { enabled, addPath } = getRuntimeConfig();
  if (!enabled || isCoolingDown() || !isEnabledForUser(params.userId)) return false;

  try {
    await request(addPath, {
      user_id: params.userId,
      session_id: params.sessionId,
      messages: params.messages,
    });
    noteSuccess();
    noteMetric('ingest', true);
    return true;
  } catch (error) {
    noteFailure();
    noteMetric('ingest', false);
    console.warn('[Vektori] ingest failed:', error);
    return false;
  }
}
```

```ts
export async function searchVektoriMemory(params: VektoriSearchParams): Promise<VektoriSearchResult | null> {
  const { enabled, searchPath, defaultDepth } = getRuntimeConfig();
  if (!enabled || isCoolingDown() || !isEnabledForUser(params.userId)) return null;

  try {
    const payload = await request(searchPath, {
      user_id: params.userId,
      query: params.query,
      depth: params.depth || defaultDepth,
      context_window: params.contextWindow ?? 2,
    });
    noteSuccess();
    noteMetric('search', true);
    return normalizeSearchPayload(payload);
  } catch (error) {
    noteFailure();
    noteMetric('search', false);
    console.warn('[Vektori] search failed:', error);
    return null;
  }
}
```

The same file also exposes [healthCheckVektori](utils/vektori/client.ts#L192), [clearVektoriMemory](utils/vektori/client.ts#L278), and [formatVektoriContext](utils/vektori/client.ts#L299), which turns structured results into prompt-ready text blocks for Claude and other downstream consumers.

## Journal Ingest Path

The ingest path is where the integration became materially large. Journal create and update both trigger background Vektori ingestion in [app/api/journals/route.ts](app/api/journals/route.ts#L550) and [app/api/journals/route.ts](app/api/journals/route.ts#L750). The code does not block the journal save; it launches the ingest in the background after the DB write succeeds.

Representative snippet:

```ts
if ((await isMemoryOptedIn(user.id)) && content && content.trim().length > 20) {
  const messages = buildVektoriJournalMessages({
    title: title || '',
    content,
    journalId: journal_id,
    eventType: 'create',
    createdAt: journal.created_at || '',
    updatedAt: journal.updated_at || '',
    entryDate: journal.journal_date || journal.created_at || '',
    mood: journal.mood || '',
  });

  if (messages.length > 0) {
    ingestVektoriMessages({
      userId: user.id,
      sessionId: `journal-${journal_id}`,
      messages,
    }).catch((err) => console.error('[Vektori] Background ingest failed:', err));
  }
}
```

The payload builder in [utils/vektori/payload.js](utils/vektori/payload.js#L1) is not trivial formatting. It creates a consistent ingest envelope with journal ID, event type, title, content, mood, entry date, timestamps, and optional corrections.

Representative snippet:

```js
export function buildVektoriJournalMessages(params) {
  const title = (params?.title || '').trim();
  const content = (params?.content || '').trim();
  const mood = (params?.mood || '').trim();
  const entryDate = (params?.entryDate || '').trim();
  const createdAt = (params?.createdAt || '').trim();
  const updatedAt = (params?.updatedAt || '').trim();
  const eventType = (params?.eventType || 'upsert').trim();
  const corrections = Array.isArray(params?.corrections) ? params.corrections : [];
```

That payload is used not only in the live journal write path, but also in the backfill and repair paths.

## Retrieval Path In Chat

Chat first tries Vektori and then falls back to legacy memory. The orchestration lives in [app/api/chat/route.ts](app/api/chat/route.ts#L99) and is triggered from the main POST handler at [app/api/chat/route.ts](app/api/chat/route.ts#L173).

Representative snippet:

```ts
async function fetchUnifiedMemoryContext(userId: string, queryText: string): Promise<{ context: string; source: 'vektori' | 'legacy' | 'none' }> {
  const vektoriResult = await searchVektoriMemory({
    userId,
    query: queryText,
    depth: 'l1',
    contextWindow: 2,
  });

  const vektoriContext = formatVektoriContext(vektoriResult);
  if (vektoriContext) {
    return { context: vektoriContext, source: 'vektori' };
  }

  const legacyContext = await fetchKnowledgeContext(userId, queryText);
  if (legacyContext) {
    return { context: legacyContext, source: 'legacy' };
  }

  return { context: '', source: 'none' };
}
```

This is important because it shows the integration is production-safe. Vektori is attempted first, but the product is explicitly designed not to break if it returns nothing or fails.

## Retrieval Path In AI Todo

AI todo generation also consumes memory context. In [app/api/ai-todo/route.ts](app/api/ai-todo/route.ts#L166), the code derives Vektori context from the task list itself so task generation can be influenced by prior journal history.

It is used in at least two places:

- generated-task classification at [app/api/ai-todo/route.ts](app/api/ai-todo/route.ts#L362),
- calendar-event task generation at [app/api/ai-todo/route.ts](app/api/ai-todo/route.ts#L483) and [app/api/ai-todo/route.ts](app/api/ai-todo/route.ts#L489).

That means Vektori is not only powering one user-facing feature; it is feeding multiple AI workflows.

## Retrieval Path In Journal Analysis

The journal analysis route builds a broader historical context by blending Vektori results with legacy `user_knowledge`. That happens in [app/api/journal/[journalId]/analyze/route.ts](app/api/journal/[journalId]/analyze/route.ts#L626), [app/api/journal/[journalId]/analyze/route.ts](app/api/journal/[journalId]/analyze/route.ts#L632), [app/api/journal/[journalId]/analyze/route.ts](app/api/journal/[journalId]/analyze/route.ts#L650), and [app/api/journal/[journalId]/analyze/route.ts](app/api/journal/[journalId]/analyze/route.ts#L655).

Representative snippet:

```ts
const [vektoriEntry, vektoriBroad, legacyKnowledge] = await Promise.all([
  searchVektoriMemory({
    userId,
    query: entryQuery,
    depth: 'l2',
    contextWindow: 12,
  }),
  searchVektoriMemory({
    userId,
    query: broadQuery,
    depth: 'l2',
    contextWindow: 12,
  }),
  adminClient
    .from('user_knowledge')
    .select('knowledge_type,category,content,confidence,last_seen_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('confidence', { ascending: false })
    .order('last_seen_at', { ascending: false })
    .limit(240),
]);
```

This route then formats both Vektori contexts via [formatVektoriContext](utils/vektori/client.ts#L299) before injecting them into the analysis prompt.

## Vektori Search API

The dedicated search route in [app/api/vektori/search/route.ts](app/api/vektori/search/route.ts#L89) is more than a pass-through. It builds search plans, tries multiple query variants, scores the result, and can repair missing Vektori indexing from local journal candidates.

At a high level, that route coordinates:

- remote Vektori search,
- local candidate extraction,
- repair of missing memory records,
- fallback synthesis for when only partial context exists,
- and a normalized response shape for the UI.

This is the kind of orchestration that shows real engineering effort: it is not one request, but a search-and-repair pipeline.

The route starts by generating a query plan, then tests each candidate search string against Vektori, then ranks the result using a local score, and only after that considers repair and fallback synthesis. The control flow is intentionally layered so the app can recover useful memory even when one of the upstream indexes is stale or partially missing.

Representative snippet:

```ts
async function searchBestVektoriMatch(params: {
  userId: string;
  searchPlan: ReturnType<typeof buildSearchPlan>;
  depth: 'l0' | 'l1' | 'l2';
  contextWindow: number;
}) {
  let bestResult: Awaited<ReturnType<typeof searchVektoriMemory>> = null;
  let bestScore = 0;
  let queryUsed = params.searchPlan.primary;

  for (const candidateQuery of params.searchPlan.searchQueries) {
    const attempt = await searchVektoriMemory({
      userId: params.userId,
      query: candidateQuery,
      depth: params.depth,
      contextWindow: params.contextWindow,
    });

    const score = scoreVektoriResult(attempt, params.searchPlan.baseTerms);
    if (score > bestScore) {
      bestScore = score;
      bestResult = attempt;
      queryUsed = candidateQuery;
    }
  }

  return { result: bestResult, bestScore, queryUsed };
}
```

The route then merges Vektori hits with locally supplied candidates, synthesizes a final memory answer, and preserves metadata like `queryUsed`, `memoryRepaired`, and `usedClientFallback` so the UI can show exactly how the answer was assembled.

## Query Heuristics And Ranking

The search pipeline is backed by a dedicated heuristic module in [utils/vektori/query.js](utils/vektori/query.js#L1). That file is responsible for the actual language handling that makes the feature feel intelligent instead of keyword-only. It normalizes stemmed words, expands synonyms, strips filler words, and scores candidate entries against the user's real intent.

Representative snippet:

```js
export function buildSearchPlan(query) {
  const primary = extractSearchTerms(query) || String(query || '').trim().toLowerCase();
  const baseTerms = primary.split(/\s+/).filter(Boolean);
  const expandedTerms = expandSearchTerms(query);
  const searchQueries = [primary];

  if (expandedTerms.length > 0) {
    searchQueries.push(expandedTerms.join(' '));
    for (const term of baseTerms) {
      const variants = expandSingleTerm(term);
      if (variants.length > 0) {
        searchQueries.push(variants.join(' '));
      }
    }
  }

  return {
    primary,
    baseTerms,
    expandedTerms,
    searchQueries: [...new Set(searchQueries.filter(Boolean))],
  };
}
```

That module also exposes [scoreTextMatch](utils/vektori/query.js#L144) and [scoreVektoriResult](utils/vektori/query.js#L165), which are the scoring functions used to choose between candidate search strings. This is important because the search route does not blindly trust the first vector result; it actively ranks competing matches and prefers the one that best fits the query intent.

The heuristics are covered by focused tests in [scripts/vektori-query.test.mjs](scripts/vektori-query.test.mjs#L1), which assert query normalization, stemming, synonym expansion, intent matching, and search plan generation.

## Candidate Parsing And Synthesis

Once raw Vektori text is returned, it is parsed back into structured journal candidates by [utils/vektori/parseJournalMemory.ts](utils/vektori/parseJournalMemory.ts#L1). That file is what allows the system to treat memory excerpts as usable entries rather than opaque blobs of text.

Representative snippet:

```ts
export function parseJournalMemoryText(text: string): ParsedJournalMemory | null {
  const journalId = text.match(/Journal ID:\s*(.+)/)?.[1]?.trim();
  const title = text.match(/Title:\s*(.+)/)?.[1]?.trim();
  const content = text.match(/Content:\s*([\s\S]*?)(?:\nMood:|\nEntry Date:|\nCreated At:|$)/)?.[1]?.trim();
  const entryDate = text.match(/Entry Date:\s*(.+)/)?.[1]?.trim();
  const mood = text.match(/Mood:\s*(.+)/)?.[1]?.trim();

  if (!title && !content) return null;

  return {
    journalId: journalId || 'unknown',
    title: title || 'Untitled entry',
    content: content || '',
    entryDate,
    mood,
  };
}
```

The same module also provides [collectCandidateMemories](utils/vektori/parseJournalMemory.ts#L29), [mergeSearchCandidates](utils/vektori/parseJournalMemory.ts#L48), [truncateText](utils/vektori/parseJournalMemory.ts#L70), and [buildCandidateContext](utils/vektori/parseJournalMemory.ts#L76). Those helpers are used to merge remote hits with local candidates and then create a compact prompt context.

The final natural-language answer is generated in [utils/vektori/synthesizeMemory.ts](utils/vektori/synthesizeMemory.ts#L1). That file optionally calls Anthropic, but it also includes a fallback synthesis path when the model is unavailable or there are no strong results.

Representative snippet:

```ts
export async function synthesizeMemoryResults(params: {
  query: string;
  facts?: RawSearchItems;
  episodes?: RawSearchItems;
  sentences?: RawSearchItems;
  directCandidates?: ParsedJournalMemory[];
  rankedCandidates?: ParsedJournalMemory[];
}): Promise<SynthesizedMemoryResponse | null> {
```

The fallback path in [buildFallbackSynthesis](utils/vektori/synthesizeMemory.ts#L153) guarantees the UI still gets a coherent answer even when the model is unavailable. That keeps the memory layer looking complete instead of brittle.

## Backfill State And Recovery Artifacts

The front-end backfill button is not a simple upload control. It persists sync state locally through [utils/vektori/syncLedger.ts](utils/vektori/syncLedger.ts#L1), which stores per-journal fingerprints in browser storage so the UI can skip entries that are already indexed.

That local state is paired with checkpoint files used by the web app's operational scripts, including `.vektori-mock-store.json`, `.vektori-backfill-checkpoint.json`, and its backups. Those artifacts make the memory layer reproducible in development and make large backfills restartable instead of all-or-nothing.

The maintenance path in [utils/vektori/repairMemory.ts](utils/vektori/repairMemory.ts#L5) exists so the app can recover when the index is stale. It rebuilds Vektori messages from parsed candidates and re-ingests them entry by entry.

## Verification And Operational Tooling

There is a separate verification and diagnostics surface in the `scripts/` folder that exercises the Vektori implementation from multiple angles:

- [scripts/vektori-config.test.mjs](scripts/vektori-config.test.mjs#L1) checks env parsing, headers, and rollout rules.
- [scripts/vektori-query.test.mjs](scripts/vektori-query.test.mjs#L1) validates stemming, synonym expansion, search planning, and scoring.
- [scripts/vektori-payload.test.mjs](scripts/vektori-payload.test.mjs#L1) checks the message builder and empty-journal behavior.
- [scripts/vektori-backfill.mjs](scripts/vektori-backfill.mjs#L1) performs resumable batch indexing with checkpointing.
- [scripts/spot_check_vektori.mjs](scripts/spot_check_vektori.mjs#L1) queries the latest checkpointed journal and probes the shim or service directly.

Representative backfill script snippet:

```mjs
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(process.env.VEKTORI_API_KEY ? { Authorization: `Bearer ${process.env.VEKTORI_API_KEY}` } : {}),
  },
  body: JSON.stringify({
    user_id: userId,
    session_id: sessionId,
    messages,
  }),
});
```

The backfill script keeps a checkpoint file, fetches journals page by page, skips encrypted or empty rows, and records how many items were processed, ingested, skipped, and failed. That is materially more work than a one-shot import command because it is built to survive restarts and partial failures.

## Diagnostics And Failure Control

The system exposes runtime health and counters in [app/api/vektori/health/route.ts](app/api/vektori/health/route.ts#L5). That endpoint is backed by the adapter's own runtime state and service probe, which means the UI can distinguish between “configured,” “reachable,” “cooling down,” and “fallback active.”

Representative snippet:

```ts
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const runtime = getVektoriRuntimeStatus();
    const metrics = getVektoriMetrics();
    const health = await healthCheckVektori();

    return NextResponse.json(
      {
        ok: health.ok,
        runtime,
        metrics,
        service: health,
      },
      { status: health.ok ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

The adapter itself keeps counters for ingest, search, clear, and health, and the `coolingDown` flag prevents repeated failures from hammering the service. That makes the integration more than a happy-path HTTP wrapper; it behaves like a small resilience layer.

The dashboard and settings surfaces consume these signals directly. In [components/dashboard-b2c/VektoriSnapshot.tsx](components/dashboard-b2c/VektoriSnapshot.tsx#L71), the user sees a high-level snapshot and a readable service state. In [components/integrations/VektoriMemoryPanel.tsx](components/integrations/VektoriMemoryPanel.tsx#L50), the user sees live diagnostic counters, rollout, and the current memory lifecycle controls in one place.

## Backfill And Repair

There are three separate backfill-related layers.

First, the API backfill endpoint in [app/api/vektori/backfill/route.ts](app/api/vektori/backfill/route.ts#L34) ingests batches of journals and respects opt-in settings. It is limited to a maximum batch size and uses the same payload builder as live ingest.

Second, the UI backfill control in [components/integrations/VektoriBackfillButton.tsx](components/integrations/VektoriBackfillButton.tsx#L121) decrypts journals client-side, paginates through the journal list, skips already indexed items via a sync ledger, and posts only the necessary plaintext batches.

Representative snippet:

```ts
const decrypted = await decryptJournalEntry(
  {
    title_encrypted: String(entry.title_encrypted),
    title_iv: String(entry.title_iv),
    content_encrypted: String(entry.content_encrypted),
    content_iv: String(entry.content_iv),
    date: String(entry.date || entry.journal_date || ''),
    is_favorite: Boolean(entry.is_favorite),
    is_archived: Boolean(entry.is_archived),
    journal_type: entry.journal_type as string | null | undefined,
    mood: entry.mood as string | null | undefined,
    tags: entry.tags as string[] | null | undefined,
    location: entry.location as string | null | undefined,
    weather: entry.weather as string | null | undefined,
  },
  entry.user_id
);
```

Third, the repair path in [utils/vektori/repairMemory.ts](utils/vektori/repairMemory.ts#L5) rebuilds messages from parsed journal candidates and re-ingests them if Vektori came back empty or under-populated.

Supporting state is tracked in [utils/vektori/syncLedger.ts](utils/vektori/syncLedger.ts#L1), which persists per-journal sync status so the button can avoid redundant re-indexing.

## Privacy, Opt-In, And Clear Memory

User privacy was designed into the integration, not bolted on later. The privacy API in [app/api/vektori/privacy/route.ts](app/api/vektori/privacy/route.ts#L17) returns the memory lifecycle settings, and the POST handler at [app/api/vektori/privacy/route.ts](app/api/vektori/privacy/route.ts#L44) supports opt-in, opt-out, and clear actions.

Representative snippet:

```ts
if (action === 'clear') {
  await adminClient
    .from('user_knowledge')
    .update({ is_active: false, forget_reason: 'User requested memory clear' })
    .eq('user_id', user.id)
    .eq('is_active', true);

  await clearVektoriMemory({ userId: user.id, sessionId: body.sessionId || undefined });

  const { data: settings } = await adminClient
    .from('user_settings')
    .update({ memory_last_cleared_at: new Date().toISOString(), memory_opt_in: true })
    .eq('user_id', user.id)
    .select('memory_opt_in,memory_retention_days,memory_rollout_percent,memory_last_cleared_at')
    .single();
}
```

This is a strong employer-facing detail because it shows the work included data lifecycle management, not just retrieval plumbing.

## User-Facing Controls And Diagnostics

The Settings UI exposes a complete memory management surface in [components/integrations/VektoriMemoryPanel.tsx](components/integrations/VektoriMemoryPanel.tsx#L50).

It includes:

- live health refresh,
- enabled/configured/cooldown status,
- ingest/search/fallback counters,
- opt-in toggle,
- rollout percentage controls,
- retention horizon controls,
- one-click backfill,
- clear memory action,
- and a fallback-safe explanation for the user.

The Memory Explorer in [components/integrations/VektoriMemoryExplorer.tsx](components/integrations/VektoriMemoryExplorer.tsx#L47) gives a searchable UI that pulls local journal candidates with [findLocalJournalCandidates](utils/vektori/localJournalSearch.ts#L93) and then asks the server to search Vektori first.

Representative snippet:

```ts
const response = await fetch('/api/vektori/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: trimmed,
    depth: 'l1',
    journals: localCandidates,
  }),
});
```

The dashboard snapshot in [components/dashboard-b2c/VektoriSnapshot.tsx](components/dashboard-b2c/VektoriSnapshot.tsx#L71) provides a client-facing proof point that the memory layer exists, is indexed, and is inspectable without devtools. It also surfaces fallback status explicitly at [components/dashboard-b2c/VektoriSnapshot.tsx](components/dashboard-b2c/VektoriSnapshot.tsx#L240).

That snapshot is intentionally tied to the same backend status endpoint as the settings panel, so the UI does not drift into a separate interpretation of service health. The result is a single operational picture that can be shown to users, QA, or stakeholders without opening logs.

## End-to-End Data Flow

The full loop runs across multiple layers instead of a single feature module:

1. A journal is created or updated in [app/api/journals/route.ts](app/api/journals/route.ts#L550) or [app/api/journals/route.ts](app/api/journals/route.ts#L750).
1. The content is transformed into a Vektori message bundle with [buildVektoriJournalMessages](utils/vektori/payload.js#L1).
1. The adapter sends the bundle through [ingestVektoriMessages](utils/vektori/client.ts#L235), which applies rollout, cooldown, timeout, and service headers.
1. Later, chat, todo generation, or analysis requests call [searchVektoriMemory](utils/vektori/client.ts#L256).
1. Search results are normalized and compressed by [formatVektoriContext](utils/vektori/client.ts#L299) before being injected into prompts.
1. If the index is stale or absent, the search route can repair and resynthesize results instead of returning a hard failure.

The important architectural detail is that the same memory layer supports both write-time indexing and read-time retrieval, so one implementation investment feeds multiple product flows.

## API Surface Map

The integration exposes a clearly separated set of HTTP endpoints:

- [GET /api/vektori/health](app/api/vektori/health/route.ts#L5) for runtime state and upstream reachability.
- [POST /api/vektori/search](app/api/vektori/search/route.ts#L89) for user-scoped memory lookup.
- [POST /api/vektori/backfill](app/api/vektori/backfill/route.ts#L34) for batch indexing of historical journals.
- [GET /api/vektori/privacy](app/api/vektori/privacy/route.ts#L17) for lifecycle settings.
- [POST /api/vektori/privacy](app/api/vektori/privacy/route.ts#L44) for opt-in, opt-out, and clear-memory actions.

That separation matters because each route has its own caller context, authorization boundary, and failure mode. The UI can ask for status without mutating data, the search screen can query memory without editing it, and the privacy action can clear both Vektori and legacy memory in one request.

## Local Development Shim

The local shim in [vektori_shim/main.py](vektori_shim/main.py#L15) makes development and demoing possible without a production Vektori deployment.

It supports two modes:

- use the real Vektori Python SDK if it is installed,
- otherwise fall back to a persistent local mock store.

Representative snippet:

```py
try:
    from vektori import Vektori
    HAS_VEKTORI = True
except Exception:
    HAS_VEKTORI = False

app = FastAPI(title="Vektori Shim")
```

The runtime startup logic at [vektori_shim/main.py](vektori_shim/main.py#L127) initializes the client if possible, [vektori_shim/main.py](vektori_shim/main.py#L144) handles ingest, [vektori_shim/main.py](vektori_shim/main.py#L203) handles search, and [vektori_shim/main.py](vektori_shim/main.py#L267) exposes health data including the persistent mock store path.

The local developer instructions live in [vektori_shim/README.md](vektori_shim/README.md#L1).

## Database Migration

The memory controls migration in [db/migrations/20260614_add_vektori_memory_controls.sql](db/migrations/20260614_add_vektori_memory_controls.sql#L1) adds the data needed for opt-in, retention, rollout, and last-cleared tracking.

Representative snippet:

```sql
alter table public.user_settings
  add column if not exists memory_opt_in boolean not null default true,
  add column if not exists memory_retention_days integer not null default 365,
  add column if not exists memory_rollout_percent integer not null default 100,
  add column if not exists memory_last_cleared_at timestamptz null;

alter table public.user_settings
  add constraint user_settings_memory_rollout_percent_check
  check (memory_rollout_percent >= 0 and memory_rollout_percent <= 100);
```

This is the kind of schema work that is easy to miss when describing a feature casually, but it is real implementation work and it matters for production control.

## Production / Demo Surface

The repository already includes the environment wiring in [apps/web/.env](.env#L89), where the local development values for `VEKTORI_ENABLED`, `VEKTORI_BASE_URL`, and `VEKTORI_API_KEY` are set.

The integration guide in [VEKTORI_INTEGRATION.md](VEKTORI_INTEGRATION.md#L1) provides the operational story, while this document focuses on the engineering evidence underneath it.

## Why This Is A Large Amount Of Work

If you need a concise justification for an employer, the strongest argument is that this work spans the full product stack:

- backend request orchestration,
- journaling persistence,
- encrypted-data backfill,
- search scoring and repair,
- privacy and retention lifecycle,
- rollout controls,
- monitoring and cooldown handling,
- UX surfaces for settings and search,
- local dev infrastructure,
- and fallbacks that keep the app stable when the new service is down.

In other words, Vektori is not one feature. It is a system-level memory integration with multiple entry points and safeguards.
