import {
  handlePhotonMessage,
  processPhotonPayload,
  verifySignature,
  type PhotonPayload,
} from '@/lib/photon/webhook';
import type { PhotonExecuteParams, ToolAdapter, ToolHealth, ToolResult } from '../types';

export { handlePhotonMessage, processPhotonPayload, verifySignature, type PhotonPayload };

export const photonAdapter: ToolAdapter<PhotonExecuteParams, unknown> = {
  name: 'photon',

  async execute(params: PhotonExecuteParams): Promise<ToolResult<unknown>> {
    try {
      const action = params.action || 'process';

      if (action === 'verify') {
        if (!params.rawBody || !params.timestamp || !params.signature) {
          return { ok: false, error: 'rawBody, timestamp, and signature are required for verification' };
        }
        const valid = verifySignature(params.rawBody, params.timestamp, params.signature);
        return { ok: valid, data: { valid } };
      }

      if (action === 'process' || action === 'ingest') {
        if (!params.payload) {
          return { ok: false, error: 'payload is required for message processing' };
        }
        const result = await handlePhotonMessage(params.payload as PhotonPayload, params.adminClient);
        return { ok: true, data: result };
      }

      return { ok: false, error: `Unsupported action "${action}"` };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Photon adapter execution failed',
      };
    }
  },

  async health(): Promise<ToolHealth> {
    const started = Date.now();
    const secret = process.env.WEBHOOK_SECRET || process.env.PHOTON_WEBHOOK_SECRET || '';
    const configured = Boolean(secret);

    return {
      ok: configured,
      name: 'photon',
      error: configured ? undefined : 'WEBHOOK_SECRET or PHOTON_WEBHOOK_SECRET is not configured',
      latencyMs: Date.now() - started,
    };
  },
};
