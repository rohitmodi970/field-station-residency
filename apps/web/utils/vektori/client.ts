import { createVektoriHeaders, getVektoriConfig, isVektoriEnabled, isVektoriEnabledForUser } from './config.js';

type VektoriRole = 'user' | 'assistant' | 'system';

export interface VektoriMessage {
  role: VektoriRole;
  content: string;
}

export interface VektoriSearchResultItem {
  text: string;
  score?: number;
}

export interface VektoriSearchResult {
  facts: VektoriSearchResultItem[];
  episodes: VektoriSearchResultItem[];
  sentences: VektoriSearchResultItem[];
}

export interface VektoriIngestParams {
  userId: string;
  sessionId: string;
  messages: VektoriMessage[];
}

export interface VektoriSearchParams {
  userId: string;
  query: string;
  depth?: 'l0' | 'l1' | 'l2';
  contextWindow?: number;
}

let failureCount = 0;
let disabledUntil = 0;
let ingestSuccessCount = 0;
let ingestFailureCount = 0;
let searchSuccessCount = 0;
let searchFailureCount = 0;
let clearSuccessCount = 0;
let clearFailureCount = 0;
let healthSuccessCount = 0;
let healthFailureCount = 0;
let lastMetricEventAt = 0;

function getRuntimeConfig() {
  return getVektoriConfig();
}

function isEnabledForUser(userId: string): boolean {
  return isVektoriEnabledForUser(userId);
}

function isCoolingDown(): boolean {
  return Date.now() < disabledUntil;
}

function noteFailure() {
  failureCount += 1;
  const { failureThreshold, cooldownMs } = getRuntimeConfig();
  if (failureCount >= failureThreshold) {
    disabledUntil = Date.now() + cooldownMs;
  }
}

function noteSuccess() {
  failureCount = 0;
  disabledUntil = 0;
}

function noteMetric(kind: 'ingest' | 'search' | 'clear' | 'health', success: boolean) {
  lastMetricEventAt = Date.now();

  if (kind === 'ingest') {
    if (success) ingestSuccessCount += 1;
    else ingestFailureCount += 1;
    return;
  }

  if (kind === 'search') {
    if (success) searchSuccessCount += 1;
    else searchFailureCount += 1;
    return;
  }

  if (kind === 'clear') {
    if (success) clearSuccessCount += 1;
    else clearFailureCount += 1;
    return;
  }

  if (success) healthSuccessCount += 1;
  else healthFailureCount += 1;
}

function toArray(items: any): VektoriSearchResultItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return { text: item };
      if (!item || typeof item !== 'object') return null;
      const text = typeof item.text === 'string' ? item.text : '';
      if (!text) return null;
      const score = typeof item.score === 'number' ? item.score : undefined;
      return { text, score };
    })
    .filter((item): item is VektoriSearchResultItem => Boolean(item));
}

function normalizeSearchPayload(payload: any): VektoriSearchResult {
  return {
    facts: toArray(payload?.facts),
    episodes: toArray(payload?.episodes),
    sentences: toArray(payload?.sentences),
  };
}

async function request(path: string, body: Record<string, unknown>, method: 'POST' | 'GET' = 'POST') {
  const { baseUrl, timeoutMs } = getRuntimeConfig();
  if (!baseUrl) throw new Error('VEKTORI_BASE_URL missing');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let url = `${baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: createVektoriHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    };

    if (method === 'GET' && body) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined && v !== null) {
          searchParams.append(k, String(v));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    } else if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Vektori request failed (${response.status}): ${text}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export type VektoriRuntimeStatus = {
  enabled: boolean;
  configured: boolean;
  coolingDown: boolean;
  failureCount: number;
  disabledUntil: number;
  rolloutPercent: number;
};

export type VektoriMetrics = {
  ingestSuccessCount: number;
  ingestFailureCount: number;
  searchSuccessCount: number;
  searchFailureCount: number;
  clearSuccessCount: number;
  clearFailureCount: number;
  healthSuccessCount: number;
  healthFailureCount: number;
  lastMetricEventAt: number;
};

export function getVektoriRuntimeStatus(): VektoriRuntimeStatus {
  const { configured, rolloutPercent } = getRuntimeConfig();
  return {
    enabled: isVektoriEnabled(),
    configured,
    coolingDown: isCoolingDown(),
    failureCount,
    disabledUntil,
    rolloutPercent,
  };
}

export function getVektoriMetrics(): VektoriMetrics {
  return {
    ingestSuccessCount,
    ingestFailureCount,
    searchSuccessCount,
    searchFailureCount,
    clearSuccessCount,
    clearFailureCount,
    healthSuccessCount,
    healthFailureCount,
    lastMetricEventAt,
  };
}

export async function healthCheckVektori(): Promise<{ ok: boolean; status?: number; error?: string; storeCount?: number }> {
  const { enabled, baseUrl, healthPath } = getRuntimeConfig();

  if (!enabled) {
    return { ok: false, error: 'VEKTORI_DISABLED_OR_NOT_CONFIGURED' };
  }

  if (!baseUrl) {
    return { ok: false, error: 'VEKTORI_BASE_URL_MISSING' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRuntimeConfig().timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${healthPath}`, {
      method: 'GET',
      headers: createVektoriHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      noteFailure();
      noteMetric('health', false);
      return { ok: false, status: response.status, error: `HTTP_${response.status}` };
    }

    const payload = await response.json().catch(() => ({}));
    const storeCount = typeof payload?.mock_entries === 'number' ? payload.mock_entries : undefined;

    noteSuccess();
    noteMetric('health', true);
    return { ok: true, status: response.status, storeCount };
  } catch (error) {
    noteFailure();
    noteMetric('health', false);
    return { ok: false, error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' };
  } finally {
    clearTimeout(timeout);
  }
}

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
  } catch (error: any) {
    noteFailure();
    noteMetric('ingest', false);
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[Vektori] ingest unavailable: ${msg.split('\n')[0]}`);
    return false;
  }
}

export async function searchVektoriMemory(params: VektoriSearchParams): Promise<VektoriSearchResult | null> {
  const { enabled, searchPath, defaultDepth } = getRuntimeConfig();
  if (!enabled || isCoolingDown() || !isEnabledForUser(params.userId)) return null;

  try {
    // Vektori production service expects GET /search?user_id=...&q=...
    // Fall back to POST if the endpoint returns 405 Method Not Allowed
    let payload: any;
    try {
      payload = await request(
        searchPath,
        {
          user_id: params.userId,
          q: params.query,
          query: params.query,
          depth: params.depth || defaultDepth,
        },
        'GET'
      );
    } catch (getErr: any) {
      if (getErr?.message?.includes('405')) {
        payload = await request(
          searchPath,
          {
            user_id: params.userId,
            query: params.query,
            depth: params.depth || defaultDepth,
            context_window: params.contextWindow ?? 2,
          },
          'POST'
        );
      } else {
        throw getErr;
      }
    }

    noteSuccess();
    noteMetric('search', true);
    return normalizeSearchPayload(payload);
  } catch (error: any) {
    noteFailure();
    noteMetric('search', false);
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[Vektori] search unavailable: ${msg.split('\n')[0]}`);
    return null;
  }
}

export async function clearVektoriMemory(params: { userId: string; sessionId?: string }): Promise<boolean> {
  const { enabled, clearPath } = getRuntimeConfig();
  if (!enabled || isCoolingDown() || !isEnabledForUser(params.userId)) return false;

  try {
    await request(clearPath, {
      user_id: params.userId,
      ...(params.sessionId ? { session_id: params.sessionId } : {}),
      scope: 'user',
    });
    noteSuccess();
    noteMetric('clear', true);
    return true;
  } catch (error) {
    noteFailure();
    noteMetric('clear', false);
    console.warn('[Vektori] clear failed:', error);
    return false;
  }
}

export function formatVektoriContext(result: VektoriSearchResult | null): string {
  if (!result) return '';

  const parts: string[] = [];

  if (result.facts.length > 0) {
    parts.push('VEKTORI FACTS:');
    result.facts.slice(0, 6).forEach((fact) => parts.push(`- ${fact.text}`));
  }

  if (result.episodes.length > 0) {
    parts.push('VEKTORI EPISODES:');
    result.episodes.slice(0, 4).forEach((episode) => parts.push(`- ${episode.text}`));
  }

  if (result.sentences.length > 0) {
    parts.push('VEKTORI SENTENCES:');
    result.sentences.slice(0, 4).forEach((sentence) => parts.push(`- ${sentence.text}`));
  }

  return parts.join('\n').trim();
}
