/**
 * Force V2 — Firecrawl Site-to-Markdown Client
 * Crawls personal websites, portfolios, Substack homepages, and blogs into clean markdown.
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

export interface FirecrawlScrapeResponse {
  markdown: string;
  title?: string;
  description?: string;
  url: string;
  success: boolean;
  error?: string;
}

export async function scrapeFirecrawlSite(targetUrl: string): Promise<FirecrawlScrapeResponse> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const startTime = Date.now();

  if (!apiKey) {
    console.warn('⚠️ [Enrichment:Firecrawl] FIRECRAWL_API_KEY is not configured — skipping site crawl.');
    return {
      markdown: '',
      url: targetUrl,
      success: false,
      error: 'FIRECRAWL_API_KEY not configured',
    };
  }

  // Ensure protocol
  let formattedUrl = targetUrl.trim();
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = `https://${formattedUrl}`;
  }

  console.log(`🌐 [Enrichment:Firecrawl] Starting site scrape for: ${formattedUrl}`);

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 5000,
      }),
      signal: AbortSignal.timeout(5000), // 5s timeout budget
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ [Enrichment:Firecrawl] Scrape failed in ${durationMs}ms (HTTP ${response.status}):`, errText.slice(0, 150));
      return {
        markdown: '',
        url: formattedUrl,
        success: false,
        error: `Firecrawl returned ${response.status}: ${errText}`,
      };
    }

    const json = await response.json();
    const data = json.data || {};
    const markdown = (data.markdown || '').slice(0, 4000); // Cap at 4k chars to stay token efficient

    console.log(`✅ [Enrichment:Firecrawl] Scraped "${data.metadata?.title || formattedUrl}" in ${durationMs}ms (${markdown.length} markdown chars)`);

    return {
      markdown,
      title: data.metadata?.title,
      description: data.metadata?.description,
      url: formattedUrl,
      success: true,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    console.error(`❌ [Enrichment:Firecrawl] Scrape failed in ${durationMs}ms:`, error?.name === 'TimeoutError' ? 'Timeout (exceeded 5s)' : (error?.message || error));
    return {
      markdown: '',
      url: formattedUrl,
      success: false,
      error: error?.name === 'TimeoutError' ? 'Firecrawl scrape timed out after 5s' : error?.message,
    };
  }
}
