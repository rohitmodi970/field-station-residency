import { GoogleGenAI } from '@google/genai';

export interface LLMResponse {
  text: string;
  model: string;
  error?: string;
}

export interface LLMOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  includeWordCloud?: boolean;
  includeMoodDistribution?: boolean;
  includeGoals?: boolean;
  includeSocialInteractions?: boolean;
  includeFlowData?: boolean;
  rawPrompt?: boolean;
}

export type LLMProvider = 'gemini' | 'openai' | 'claude';

// Guarded configurations with bounded token ceilings to avoid runaway costs
export const LLM_CONFIG = {
  gemini: {
    modelName: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    defaultMaxTokens: 4096,
    hardTokenCap: 8192,
  },
  openai: {
    modelName: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    defaultMaxTokens: 4096,
    hardTokenCap: 4096,
  },
  claude: {
    modelName: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
    defaultMaxTokens: 4096,
    hardTokenCap: 8192,
  },
};

export const MAX_PROMPT_LENGTH_CHARS = 40_000;

/**
 * Returns the internal secret key used to authenticate trusted backend-to-backend LLM calls.
 */
export function getInternalSecret(): string {
  const secret =
    process.env.INTERNAL_API_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ENCRYPTION_KEY;

  if (!secret) {
    console.warn('[LLM Service] Warning: No server secret found in environment for internal LLM validation.');
    return 'force_internal_fallback_secret_key';
  }
  return secret;
}

/**
 * Validates whether a provided internal secret matches the server secret.
 */
export function isInternalSecretValid(candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  const expected = getInternalSecret();
  return candidate === expected;
}

/**
 * Returns headers for internal server-to-server calls to /api/llm.
 */
export function getInternalLLMHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-internal-secret': getInternalSecret(),
  };
}

/**
 * Executes an LLM prompt using the requested or default provider with credit-exhaustion safeguards.
 */
export async function executeLLMRequest(params: {
  prompt: string;
  provider?: string;
  options?: LLMOptions;
}): Promise<LLMResponse> {
  const { prompt, options = {} } = params;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Prompt is required and must be non-empty');
  }

  if (prompt.length > MAX_PROMPT_LENGTH_CHARS) {
    throw new Error(`Prompt exceeds maximum allowed length of ${MAX_PROMPT_LENGTH_CHARS} characters`);
  }

  // Use configured default provider from environment, or fallback to gemini (most cost-effective)
  const defaultProvider = (process.env.DEFAULT_LLM_PROVIDER as LLMProvider) || 'claude';
  const selectedProvider = (params.provider || defaultProvider) as LLMProvider;

  switch (selectedProvider) {
    case 'claude':
      return getClaudeResponse(prompt, options);
    case 'openai':
      return getOpenAIResponse(prompt, options);
    case 'gemini':
      return getGeminiResponse(prompt, options);
    default:
      throw new Error(`Invalid or unsupported LLM provider: ${selectedProvider}`);
  }
}

// -------------------------------------------------------------
// Provider implementations with bounded tokens & error handling
// -------------------------------------------------------------

async function getGeminiResponse(prompt: string, options: LLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in environment variables');
  }

  const genAI = new GoogleGenAI({ apiKey });
  const structuredPrompt = options.rawPrompt ? prompt : formatJournalPromptForGemini(prompt);

  const tokenLimit = Math.min(
    options.maxTokens || LLM_CONFIG.gemini.defaultMaxTokens,
    LLM_CONFIG.gemini.hardTokenCap
  );

  const response = await genAI.models.generateContent({
    model: LLM_CONFIG.gemini.modelName,
    contents: structuredPrompt,
    // @ts-expect-error - GoogleGenAI types compatibility
    generationConfig: {
      maxOutputTokens: tokenLimit,
      temperature: options.temperature ?? 0.7,
      topP: options.topP ?? 0.95,
      topK: options.topK ?? 40,
    },
  });

  return {
    text: response.text || '',
    model: LLM_CONFIG.gemini.modelName,
  };
}

async function getOpenAIResponse(prompt: string, options: LLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not defined in environment variables');
  }

  const tokenLimit = Math.min(
    options.maxTokens || LLM_CONFIG.openai.defaultMaxTokens,
    LLM_CONFIG.openai.hardTokenCap
  );

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: LLM_CONFIG.openai.modelName,
      messages: [
        {
          role: 'system',
          content:
            'You are a compassionate, psychologically informed journal analyzer. Provide nuanced, emotionally safe insights and avoid harsh or dismissive advice.',
        },
        {
          role: 'user',
          content: options.rawPrompt ? prompt : formatJournalPromptForOpenAI(prompt, options),
        },
      ],
      max_tokens: tokenLimit,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 0.95,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI API error (${response.status})`);
  }

  const data = await response.json();
  return {
    text: data.choices?.[0]?.message?.content || '',
    model: LLM_CONFIG.openai.modelName,
  };
}

async function getClaudeResponse(prompt: string, options: LLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not defined in environment variables');
  }

  const tokenLimit = Math.min(
    options.maxTokens || LLM_CONFIG.claude.defaultMaxTokens,
    LLM_CONFIG.claude.hardTokenCap
  );

  let rawModel = process.env.ANTHROPIC_MODEL || LLM_CONFIG.claude.modelName;
  if (rawModel === 'claude-haiku-4-5' || rawModel === 'haiku-4-5' || rawModel === 'claude-haiku-4.5') {
    rawModel = 'claude-haiku-4-5-20251001';
  } else if (rawModel === 'claude-haiku-5-5' || rawModel === 'haiku-5-5' || rawModel === 'claude-haiku-5.5') {
    rawModel = 'claude-haiku-5-5';
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: rawModel,
      messages: [
        {
          role: 'user',
          content: options.rawPrompt ? prompt : formatJournalPromptForGemini(prompt),
        },
      ],
      max_tokens: tokenLimit,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 429) {
      throw new Error('Rate limit exceeded on AI provider. Please wait a moment.');
    }
    if (response.status === 402 || response.status === 403) {
      throw new Error('Anthropic API quota/access issue.');
    }
    throw new Error(error.error?.message || error.message || `Claude API error (${response.status})`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  if (!text) {
    throw new Error('Received empty response from Claude API');
  }

  return {
    text,
    model: rawModel,
  };
}

// -------------------------------------------------------------
// Structured prompt formatting helpers
// -------------------------------------------------------------

function formatJournalPromptForGemini(prompt: string): string {
  return `
You are a reflective journaling assistant helping users understand patterns in their life. Speak clearly, concisely, and compassionately. Focus on practical insight rather than philosophical interpretation.

Relational safety rules:
- Never recommend discarding, abandoning, or cutting off a person as a first-line response.
- For interpersonal conflict, prioritize nuanced options first: boundaries, calm communication, support-seeking, and reflective problem solving.
- Be kind, practical, and evidence-grounded.

Every insight you produce must follow the Mirror → Meaning → Movement structure:
- Mirror: What pattern appeared in the journal entries.
- Meaning: Why that pattern might matter in the user's life.
- Movement: A reflection prompt or small action the user could try.

IMPORTANT: You must respond ONLY with strictly valid JSON. Do not include any explanatory text, markdown formatting, or code blocks. Do not add trailing commas after array or object elements. Start your response directly with the opening brace { and end with the closing brace }.

${prompt}

Analyze these journal entries in THREE stages. Keep every output concise — no essays, no repetition.

Stage 1: Signal extraction (keywords, energy 1-10, productivity 1-10, mood influencers, emotion distribution).
Stage 2: Pattern detection (emotional triggers, energy patterns, mindmap clusters).
Stage 3: Insight generation (reflection summary, life patterns, energy & wellbeing insight, growth edge, weekly insight).

Return ONLY valid JSON with no trailing commas.
`;
}

function formatJournalPromptForOpenAI(prompt: string, options: LLMOptions): string {
  let structuredPrompt = `
Analyze the following journal entries and provide detailed insights:

${prompt}

Please provide the following analysis as a JSON object:
1. Overall sentiment analysis (include a score from -10 to +10)
2. Key topics discussed with their frequency and context
3. Patterns and trends identified with their significance
4. Personalized insights based on the entries
5. Actionable suggestions for the journal writer

Guidance:
- Use an empathetic, emotionally safe tone.
- Never recommend abandoning, discarding, or cutting off a person as a first-line suggestion.
`;

  if (options.includeWordCloud) structuredPrompt += '\n6. Most frequently used words and their context';
  if (options.includeMoodDistribution) structuredPrompt += '\n7. Mood distribution and emotional patterns';
  if (options.includeGoals) structuredPrompt += '\n8. Goals mentioned and progress tracking';
  if (options.includeSocialInteractions) structuredPrompt += '\n9. People mentioned and relationship dynamics';

  structuredPrompt += `\n\nReturn ONLY a valid JSON object.`;
  return structuredPrompt;
}
