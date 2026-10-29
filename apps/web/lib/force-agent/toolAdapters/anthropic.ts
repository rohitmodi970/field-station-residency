import type { ClaudeMessageParams, ClaudeMessageResult, ToolAdapter, ToolHealth, ToolResult } from '../types';

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

export const anthropicAdapter: ToolAdapter<ClaudeMessageParams, ClaudeMessageResult> = {
  name: 'anthropic',

  async execute(params: ClaudeMessageParams): Promise<ToolResult<ClaudeMessageResult>> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, error: 'ANTHROPIC_API_KEY is not configured' };
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          max_tokens: params.maxTokens ?? 1024,
          ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
          ...(params.system ? { system: params.system } : {}),
          ...(params.tools && params.tools.length > 0 ? { tools: params.tools } : {}),
          messages: params.messages,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          ok: false,
          error: errorData.error?.message || `Claude API request failed (${response.status})`,
        };
      }

      const responseData = await response.json();
      const contentList = Array.isArray(responseData.content) ? responseData.content : [];

      const textBlocks = contentList
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text || '');
      const text = textBlocks.join('\n\n').trim();

      const toolCalls = contentList
        .filter((block: any) => block.type === 'tool_use')
        .map((block: any) => ({
          id: block.id,
          name: block.name,
          input: block.input || {},
        }));

      if (!text && toolCalls.length === 0) {
        return { ok: false, error: 'Empty content response from Claude API' };
      }

      return {
        ok: true,
        data: {
          text,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          stopReason: responseData.stop_reason,
          usage: {
            input_tokens: responseData.usage?.input_tokens,
            output_tokens: responseData.usage?.output_tokens,
          },
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Claude adapter failed',
      };
    }
  },

  async health(): Promise<ToolHealth> {
    const started = Date.now();
    const configured = Boolean(process.env.ANTHROPIC_API_KEY);
    return {
      ok: configured,
      name: 'anthropic',
      error: configured ? undefined : 'ANTHROPIC_API_KEY missing',
      latencyMs: Date.now() - started,
    };
  },
};

export { DEFAULT_MODEL as CLAUDE_DEFAULT_MODEL };
