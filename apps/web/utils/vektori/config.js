const DEFAULT_TIMEOUT_MS = 5000;
const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 2 * 60 * 1000;

function hashString(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

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

export function createVektoriHeaders(env = process.env) {
  const headers = { 'Content-Type': 'application/json' };
  if (env.VEKTORI_API_KEY) {
    headers.Authorization = `Bearer ${env.VEKTORI_API_KEY}`;
  }
  return headers;
}

export function isVektoriEnabled(env = process.env) {
  return getVektoriConfig(env).enabled;
}

export function isVektoriEnabledForUser(userId, env = process.env) {
  const config = getVektoriConfig(env);
  if (!config.enabled) return false;
  if (!userId) return false;
  if (config.rolloutPercent >= 100) return true;
  if (config.rolloutPercent <= 0) return false;

  const bucket = hashString(String(userId)) % 100;
  return bucket < config.rolloutPercent;
}

