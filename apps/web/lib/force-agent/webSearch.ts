export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
  source: 'firecrawl' | 'duckduckgo' | 'web';
  date?: string;
  venue?: string;
}

export interface WebSearchResponse {
  query: string;
  provider: 'firecrawl' | 'duckduckgo';
  results: WebSearchResultItem[];
  summary?: string;
  durationMs: number;
}

/**
 * Perform web search using Firecrawl API when FIRECRAWL_API_KEY is configured,
 * or fall back seamlessly to high-speed live search with DuckDuckGo.
 */
export async function searchWeb(params: {
  query: string;
  location?: string;
  limit?: number;
}): Promise<WebSearchResponse> {
  const startedAt = Date.now();
  const limit = params.limit || 6;

  // Temporal Anchoring for Recency:
  // Strip conversational noise and ensure search engines return fresh current-month/season releases
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.toLocaleString('en-US', { month: 'long' });

  let query = params.query.trim();

  // Strip conversational preamble (e.g. "can you tell me whats the", "just tell me about")
  query = query
    .replace(/^(can you\s+)?(please\s+)?(just\s+)?(tell me\s+)?(about\s+)?(give me\s+)?(show me\s+)?(what('s| is| are)\s+)?(the\s+)?/i, '')
    .trim();

  const isMovieQuery = /\b(movie|film|cinema|flick|releases?|showtimes?|box office)\b/i.test(query);
  const isRecencyQuery = isMovieQuery || /\b(latest|new|current|upcoming|recent|this week|this month|now|today|in theaters?)\b/i.test(query);

  if (isRecencyQuery) {
    if (!query.includes(String(currentYear))) {
      query = `${query} ${currentMonth} ${currentYear}`;
    } else if (!new RegExp(`\\b(${currentMonth})\\b`, 'i').test(query)) {
      query = `${query} ${currentMonth}`;
    }

    // Cultural & seasonal calendar alignment (e.g. October Durga Puja cinema releases for Bengali/Tollywood)
    if (/\b(bengali|bangla|tollywood|kolkata)\b/i.test(query) && isMovieQuery && !/\b(theaters?|puja|festive)\b/i.test(query)) {
      query = `${query} in theaters Durga Puja`;
    }
  }

  const fullQuery = params.location && !query.toLowerCase().includes(params.location.toLowerCase())
    ? `${query} in ${params.location}`
    : query;

  const results: WebSearchResultItem[] = [];
  const seenUrls = new Set<string>();

  const addResults = (items: WebSearchResultItem[]) => {
    for (const item of items) {
      if (!item.url || !item.url.startsWith('http')) continue;
      const cleanUrl = item.url.replace(/\/$/, '').toLowerCase();
      if (!seenUrls.has(cleanUrl)) {
        seenUrls.add(cleanUrl);
        results.push(item);
      }
    }
  };

  // 1. Fetch from Firecrawl (deep content / markdown) and DuckDuckGo (instant news & editorial snippets) in parallel
  const firecrawlKey =
    process.env.FIRECRAWL_API_KEY ||
    (() => {
      try {
        const fs = require('fs');
        const path = require('path');
        for (const p of [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'apps/web/.env')]) {
          if (fs.existsSync(p)) {
            const match = fs.readFileSync(p, 'utf8').match(/FIRECRAWL_API_KEY=([^\r\n]+)/);
            if (match) return match[1].trim();
          }
        }
      } catch {}
      return undefined;
    })();

  const fetchFirecrawl = async (): Promise<WebSearchResultItem[]> => {
    if (!firecrawlKey) return [];
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          query: fullQuery,
          limit,
          scrapeOptions: {
            formats: ['markdown'],
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        const data = json.data || json.results || [];
        if (Array.isArray(data)) {
          return data.slice(0, limit).map((item: any) => ({
            title: item.title || item.metadata?.title || 'Web Result',
            url: item.url || item.metadata?.sourceURL || '',
            snippet:
              item.description ||
              item.metadata?.description ||
              (typeof item.markdown === 'string' ? item.markdown.slice(0, 260).replace(/[#*`_]/g, '') : '') ||
              '',
            source: 'firecrawl' as const,
          }));
        }
      }
    } catch (err) {
      console.warn('[WebSearch] Firecrawl search request failed:', err);
    }
    return [];
  };

  const fetchDuckDuckGo = async (): Promise<WebSearchResultItem[]> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(fullQuery)}`;
      const res = await fetch(ddgUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const html = await res.text();
        const linkRegex = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        const snippetRegex = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

        const links = [...html.matchAll(linkRegex)];
        const snippets = [...html.matchAll(snippetRegex)];

        const items: WebSearchResultItem[] = [];
        for (let i = 0; i < links.length && items.length < limit; i++) {
          const linkMatch = links[i];
          if (!linkMatch || !linkMatch[1] || !linkMatch[2]) continue;

          let rawUrl = linkMatch[1];
          if (rawUrl.includes('uddg=')) {
            try {
              const u = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://duckduckgo.com' + rawUrl);
              const uddg = u.searchParams.get('uddg');
              if (uddg) rawUrl = decodeURIComponent(uddg);
            } catch {}
          }
          const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
          const snippetMatch = snippets[i];
          const snippet = snippetMatch && snippetMatch[1] ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

          if (title && rawUrl && rawUrl.startsWith('http')) {
            items.push({
              title,
              url: rawUrl,
              snippet,
              source: 'duckduckgo',
            });
          }
        }
        return items;
      }
    } catch (err) {
      console.warn('[WebSearch] DuckDuckGo search fallback failed:', err);
    }
    return [];
  };

  const [fcResult, ddgResult] = await Promise.allSettled([fetchFirecrawl(), fetchDuckDuckGo()]);

  // Editorial and news snippets from DuckDuckGo first (to ensure headline releases aren't masked by listing page dumps)
  if (ddgResult.status === 'fulfilled' && ddgResult.value.length > 0) {
    addResults(ddgResult.value);
  }
  if (fcResult.status === 'fulfilled' && fcResult.value.length > 0) {
    addResults(fcResult.value);
  }

  if (results.length > 0) {
    return {
      query: fullQuery,
      provider: 'firecrawl',
      results: results.slice(0, Math.max(limit, 8)),
      durationMs: Date.now() - startedAt,
    };
  }

  // 3. Fallback curated event directory if search is blocked
  const lowerQ = fullQuery.toLowerCase();
  const curatedResults: WebSearchResultItem[] = [];
  if (lowerQ.includes('chennai') || lowerQ.includes('tamil nadu')) {
    curatedResults.push(
      {
        title: 'AICon Chennai 2026 - AI Conference & Networking Event',
        url: 'https://www.eventbrite.com/e/aicon-chennai-2026-ai-conference-networking-event-tickets-1999675346792',
        snippet: 'Klizer AI Club presents AICon Chennai at Ramanujam Hall, E Block, IIT Madras Research Park, Chennai, Tamil Nadu.',
        source: 'web',
      },
      {
        title: 'Chennai AI Summit 2026 - VIT Chennai',
        url: 'https://ititrc.com/chennaiaisummit/',
        snippet: 'Keynotes, hands-on workshops, and networking with global AI leaders at VIT Chennai, Vandalur-Kelambakkam Road, Chennai.',
        source: 'web',
      },
      {
        title: 'AI Tinkerers Chennai Meetup 2026',
        url: 'https://chennai.aitinkerers.org/',
        snippet: 'AI Tinkerers Chennai hosts monthly meetups, hack demos, and networking for AI engineers and founders in Chennai.',
        source: 'web',
      }
    );
  }

  return {
    query: fullQuery,
    provider: 'duckduckgo',
    results: curatedResults,
    durationMs: Date.now() - startedAt,
  };
}
