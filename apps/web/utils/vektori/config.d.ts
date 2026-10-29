export interface VektoriConfig {
  enabled: boolean;
  configured: boolean;
  baseUrl: string;
  apiKey: string;
  addPath: string;
  searchPath: string;
  healthPath: string;
  clearPath: string;
  defaultDepth: 'l0' | 'l1' | 'l2' | string;
  timeoutMs: number;
  failureThreshold: number;
  cooldownMs: number;
  rolloutPercent: number;
}

export function getVektoriConfig(env?: NodeJS.ProcessEnv): VektoriConfig;
export function createVektoriHeaders(env?: NodeJS.ProcessEnv): Record<string, string>;
export function isVektoriEnabled(env?: NodeJS.ProcessEnv): boolean;
export function isVektoriEnabledForUser(userId?: string | null, env?: NodeJS.ProcessEnv): boolean;
