/**
 * Force V2 — Exa.ai Semantic Web Search Client
 * Searches the public web for user mentions, Substack essays, articles, and talks.
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

export interface ExaSearchResultItem {
  id: string;
  title: string;
  url: string;
  author?: string;
  publishedDate?: string;
  summary?: string;
  highlights?: string[];
  text?: string;
  score?: number;
}

export interface ExaSearchResponse {
  results: ExaSearchResultItem[];
  success: boolean;
  error?: string;
}

export async function searchExaWeb(
  query: string,
  options: {
    numResults?: number;
    includeText?: boolean;
    includeHighlights?: boolean;
    useAutoprompt?: boolean;
  } = {}
): Promise<ExaSearchResponse> {
  const apiKey = process.env.EXA_API_KEY;
  const startTime = Date.now();

  if (!apiKey) {
    console.warn('⚠️ [Enrichment:Exa] EXA_API_KEY is not configured in environment — skipping Exa web search.');
    return {
      results: [],
      success: false,
      error: 'EXA_API_KEY not configured',
    };
  }

  console.log(`🌐 [Enrichment:Exa] Starting semantic search — Query: "${query}" (autoprompt: ${options.useAutoprompt ?? true}, limit: ${options.numResults ?? 5})`);

  try {
    let response: Response | null = null;
    let lastError: any = null;

    // Attempt with 10s, then retry once with 15s if timeout
    for (const attemptTimeout of [10000, 15000]) {
      try {
        response = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            query,
            numResults: options.numResults ?? 5,
            useAutoprompt: options.useAutoprompt ?? true,
            contents: {
              text: options.includeText ? { maxCharacters: 1500 } : false,
              highlights: options.includeHighlights ? { numSentences: 3 } : true,
              summary: true,
            },
          }),
          signal: AbortSignal.timeout(attemptTimeout),
        });
        break; // success — exit retry loop
      } catch (e: any) {
        lastError = e;
        if (e?.name === 'TimeoutError' && attemptTimeout === 10000) {
          console.warn(`⚠️ [Enrichment:Exa] First attempt timed out at 10s, retrying with 15s...`);
          continue;
        }
        throw e; // non-timeout error or second attempt — bail
      }
    }

    if (!response) {
      throw lastError || new Error('Exa fetch failed');
    }

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ [Enrichment:Exa] API error in ${durationMs}ms (HTTP ${response.status}):`, errText);
      return {
        results: [],
        success: false,
        error: `Exa API returned ${response.status}: ${errText}`,
      };
    }

    const data = await response.json();
    const items: ExaSearchResultItem[] = (data.results || []).map((item: any) => ({
      id: item.id || item.url,
      title: item.title || 'Public Mention',
      url: item.url,
      author: item.author,
      publishedDate: item.publishedDate,
      summary: item.summary,
      highlights: item.highlights || [],
      text: item.text,
      score: item.score,
    }));

    console.log(`✅ [Enrichment:Exa] Completed in ${durationMs}ms — Found ${items.length} items:`, items.map(i => `\n   • [${i.title}] (${i.url})`).join(''));

    return {
      results: items,
      success: true,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error(`❌ [Enrichment:Exa] Failed in ${durationMs}ms:`, error?.name === 'TimeoutError' ? 'Timeout (exceeded retry budget)' : (error?.message || error));
    return {
      results: [],
      success: false,
      error: error?.name === 'TimeoutError' ? 'Exa search timed out' : error?.message,
    };
  }
}
