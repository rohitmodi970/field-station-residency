import { anthropicAdapter } from './toolAdapters/anthropic';
import { cleanAiGeneratedTitle, generateSmartSemanticTitle } from './smartTitleCore';

export * from './smartTitleCore';

export interface SmartTitleParams {
  prompt: string;
  assistantResponse?: string;
  toolUsed?: string;
}

const SMART_TITLE_SYSTEM_PROMPT = `You generate short, clean, descriptive titles for chat sessions in Force, an AI reflection and personal agent application.
Rules:
1. Return ONLY the title text. No explanations, no quotes, no markdown, no ending period.
2. 2 to 4 words maximum (under 30 characters).
3. Use Title Case.
4. Be specific: identify the exact entity, domain, date, or action (e.g. "Ignite Align 11 AM Class", "Active Tasks Review", "Reflections: Aug 29 & Sep 1", "Morning Focus Synthesis", "Pitch Deck Draft").
5. NEVER use generic titles like "Action Planning", "Event Registration", "Reflection Analysis", "General Chat", or "New Conversation".
6. If a URL is mentioned, use the brand name (e.g. "Ignite Align", "Luma", "Eventbrite").`;

/**
 * Generates an AI-powered smart title using Claude Haiku 4.5.
 * Falls back to high-precision semantic NLP extraction if the API call fails or is unavailable.
 */
export async function generateSmartAITitle(params: SmartTitleParams): Promise<string> {
  const { prompt, assistantResponse, toolUsed } = params;
  const semanticFallback = generateSmartSemanticTitle(prompt);

  if (!process.env.ANTHROPIC_API_KEY) {
    return semanticFallback;
  }

  try {
    const contextLines = [
      `User prompt: ${prompt.trim().substring(0, 300)}`,
    ];
    if (toolUsed) {
      contextLines.push(`Tool used: ${toolUsed}`);
    }
    if (assistantResponse) {
      contextLines.push(`Response summary: ${assistantResponse.trim().substring(0, 200)}`);
    }

    const result = await anthropicAdapter.execute({
      system: SMART_TITLE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Generate a smart title for this chat interaction:\n\n${contextLines.join('\n')}`,
        },
      ],
      maxTokens: 25,
      temperature: 0.2,
    });

    if (result.ok && result.data?.text) {
      const cleaned = cleanAiGeneratedTitle(result.data.text, prompt);
      if (cleaned && cleaned.length >= 3 && cleaned !== 'New Conversation') {
        return cleaned;
      }
    }

    return semanticFallback;
  } catch (error) {
    console.warn('[SmartTitle] AI generation error, using semantic fallback:', error);
    return semanticFallback;
  }
}
