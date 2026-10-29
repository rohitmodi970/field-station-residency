import {
  formatVektoriContext,
  getVektoriMetrics,
  getVektoriRuntimeStatus,
  healthCheckVektori,
  ingestVektoriMessages,
  searchVektoriMemory,
} from '@/utils/vektori/client';
import type { ToolAdapter, ToolHealth, ToolResult } from '../types';
import type { VektoriIngestParams, VektoriSearchParams } from '@/utils/vektori/client';

export const vektoriAdapter: ToolAdapter<
  | { action: 'search'; params: VektoriSearchParams }
  | { action: 'ingest'; params: VektoriIngestParams }
  | { action: 'status' }
  | { action: 'metrics' },
  unknown
> = {
  name: 'vektori',

  async execute(
    params
  ): Promise<ToolResult<unknown>> {
    try {
      if (params.action === 'search') {
        const result = await searchVektoriMemory(params.params);
        return { ok: true, data: result };
      }

      if (params.action === 'ingest') {
        const ok = await ingestVektoriMessages(params.params);
        return { ok, data: { ingested: ok } };
      }

      if (params.action === 'status') {
        return { ok: true, data: getVektoriRuntimeStatus() };
      }

      if (params.action === 'metrics') {
        return { ok: true, data: getVektoriMetrics() };
      }

      return { ok: false, error: 'Unsupported action' };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Vektori adapter failed',
      };
    }
  },

  async health(): Promise<ToolHealth> {
    const started = Date.now();
    const result = await healthCheckVektori();
    return {
      ok: result.ok,
      name: 'vektori',
      error: result.error,
      latencyMs: Date.now() - started,
    };
  },
};

export function formatVektoriSearchContext(
  result: Awaited<ReturnType<typeof searchVektoriMemory>>
): string {
  return formatVektoriContext(result);
}

export function getVektoriDiagnostics() {
  return {
    runtime: getVektoriRuntimeStatus(),
    metrics: getVektoriMetrics(),
  };
}
