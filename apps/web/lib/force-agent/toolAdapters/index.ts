import { anthropicAdapter, CLAUDE_DEFAULT_MODEL } from './anthropic';
import { photonAdapter, verifySignature, handlePhotonMessage, processPhotonPayload } from './photon';
import {
  tinyfishAdapter,
  buildGoal,
  buildUniversalGoal,
  createRegistrationStream,
  createBrowserStream,
  persistTinyfishUsageContext,
  fetchEventMetadata,
} from './tinyfish';
import { vektoriAdapter, formatVektoriSearchContext, getVektoriDiagnostics } from './vektori';
import type { ToolAdapter, ToolHealth } from '../types';

export {
  anthropicAdapter,
  CLAUDE_DEFAULT_MODEL,
  vektoriAdapter,
  formatVektoriSearchContext,
  getVektoriDiagnostics,
  tinyfishAdapter,
  buildGoal,
  buildUniversalGoal,
  createRegistrationStream,
  createBrowserStream,
  persistTinyfishUsageContext,
  fetchEventMetadata,
  photonAdapter,
  verifySignature,
  handlePhotonMessage,
  processPhotonPayload,
};

export const toolRegistry: Record<string, ToolAdapter<any, any>> = {
  anthropic: anthropicAdapter,
  vektori: vektoriAdapter,
  tinyfish: tinyfishAdapter,
  photon: photonAdapter,
};

export function getToolAdapter(name: string): ToolAdapter<any, any> | undefined {
  return toolRegistry[name.toLowerCase()];
}

export async function checkAllToolsHealth(): Promise<Record<string, ToolHealth>> {
  const entries = Object.entries(toolRegistry);
  const healthResults = await Promise.all(
    entries.map(async ([key, adapter]) => {
      try {
        const health = await adapter.health();
        return [key, health] as const;
      } catch (error) {
        return [
          key,
          {
            ok: false,
            name: adapter.name,
            error: error instanceof Error ? error.message : 'Health check failed',
          },
        ] as const;
      }
    })
  );

  return Object.fromEntries(healthResults);
}

