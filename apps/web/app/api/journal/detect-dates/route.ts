import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/journal/detect-dates
 *
 * Uses Claude to analyse OCR-extracted texts from multiple journal pages,
 * detecting the written date, whether a page is a continuation of the
 * previous entry, and a confidence level.
 *
 * Request body:
 * {
 *   pages: Array<{
 *     pageIndex: number,
 *     fileName: string,
 *     text: string
 *   }>
 * }
 *
 * Returns:
 * {
 *   results: Array<{
 *     pageIndex: number,
 *     date: string | null,       // ISO date e.g. "2026-03-15"
 *     isContinuation: boolean,
 *     confidence: "high" | "medium" | "low"
 *   }>
 * }
 */

const SYSTEM_PROMPT = `You are analyzing OCR-extracted text from handwritten journal pages. The user has scanned multiple physical journal pages and we need to determine which pages belong to the same journal entry and what date each entry was written on.

For each page, determine:

1. WRITTEN DATE — the date the journal entry was written. Look for:
   - Explicit dates: "March 15, 2026", "3/15/26", "15-03-2026", "15th March"
   - Header dates: "Monday, March 15"
   - Diary conventions: "Dear Diary, Jan 5th"
   - Relative references: "Monday morning" (use context clues to infer)
   - If year is missing, assume current year (2026)
   - If no date found at all, return null

2. IS_CONTINUATION — whether this page is a continuation of the previous page's journal entry. Signs of continuation:
   - Starts mid-sentence or mid-paragraph
   - No new date header
   - Contextual flow from previous page
   - Starts with lowercase or conjunction

3. CONFIDENCE — your confidence level (high / medium / low) for the date detection

Return ONLY a JSON array. No markdown fences, no explanation, no extra text.
Example:
[
  { "pageIndex": 0, "date": "2026-03-15", "isContinuation": false, "confidence": "high" },
  { "pageIndex": 1, "date": null, "isContinuation": true, "confidence": "high" },
  { "pageIndex": 2, "date": "2026-03-17", "isContinuation": false, "confidence": "medium" }
]`;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth ─────────────────────────────────────────────────────────
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── API key ──────────────────────────────────────────────────────
    const claudeApiKey =
      process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!claudeApiKey) {
      return NextResponse.json(
        { error: 'Claude API key not configured' },
        { status: 503 },
      );
    }

    // ── Parse body ───────────────────────────────────────────────────
    const body = await request.json();
    const { pages } = body as {
      pages: Array<{ pageIndex: number; fileName: string; text: string }>;
    };

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: 'pages array is required' },
        { status: 400 },
      );
    }

    // Cap at 50 pages (matches the upload limit)
    if (pages.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 pages per request' },
        { status: 400 },
      );
    }

    // ── Build user message ───────────────────────────────────────────
    const userContent = [
      `Here are the OCR-extracted texts from ${pages.length} journal page${pages.length > 1 ? 's' : ''}, in scanning order:\n`,
      ...pages.map(
        (p) =>
          `--- PAGE ${p.pageIndex} (${p.fileName}) ---\n${p.text || '(no text extracted)'}\n`,
      ),
    ].join('\n');

    console.log(
      `[detect-dates] Processing ${pages.length} pages for user ${user.id}`,
    );

    // ── Call Claude API ──────────────────────────────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout

    const anthropicResponse = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.json().catch(() => ({}));
      console.error('[detect-dates] Claude API error:', errBody);
      return NextResponse.json(
        {
          error: `Claude API error: ${anthropicResponse.status}`,
          detail: (errBody as { error?: { message?: string } })?.error?.message,
        },
        { status: 502 },
      );
    }

    const claudeData = (await anthropicResponse.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    // Extract the text block from Claude's response
    const textBlock = claudeData.content?.find((c) => c.type === 'text');
    if (!textBlock?.text) {
      console.error('[detect-dates] Unexpected Claude response shape:', claudeData);
      return NextResponse.json(
        { error: 'Unexpected response from Claude' },
        { status: 502 },
      );
    }

    // ── Parse JSON response ──────────────────────────────────────────
    let results: Array<{
      pageIndex: number;
      date: string | null;
      isContinuation: boolean;
      confidence: 'high' | 'medium' | 'low';
    }>;

    try {
      // Strip markdown fences if Claude wraps in ```json ... ```
      let raw = textBlock.text.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      results = JSON.parse(raw);
    } catch {
      console.error(
        '[detect-dates] Failed to parse Claude JSON:',
        textBlock.text,
      );
      return NextResponse.json(
        {
          error: 'Failed to parse date detection results',
          rawResponse: textBlock.text,
        },
        { status: 502 },
      );
    }

    // Validate structure
    if (!Array.isArray(results)) {
      return NextResponse.json(
        { error: 'Claude returned non-array result', rawResponse: textBlock.text },
        { status: 502 },
      );
    }

    // Normalise & sanitise each result
    const sanitised = results.map((r, idx) => ({
      pageIndex: typeof r.pageIndex === 'number' ? r.pageIndex : idx,
      date: typeof r.date === 'string' ? r.date : null,
      isContinuation: Boolean(r.isContinuation),
      confidence:
        r.confidence === 'high' || r.confidence === 'medium' || r.confidence === 'low'
          ? r.confidence
          : 'low',
    }));

    console.log(
      `[detect-dates] Detected dates for ${sanitised.length} pages — ` +
        `${sanitised.filter((r) => r.date).length} with dates, ` +
        `${sanitised.filter((r) => r.isContinuation).length} continuations`,
    );

    return NextResponse.json({ success: true, results: sanitised });
  } catch (error) {
    console.error('[detect-dates] Error:', error);

    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Date detection timed out. Please try again.' },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to detect dates',
      },
      { status: 500 },
    );
  }
}
