import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/journal/generate-titles
 *
 * Uses Claude to generate short, meaningful titles for journal entries
 * based on their content.
 *
 * Request body:
 * {
 *   journals: Array<{
 *     groupId: string,
 *     combinedText: string   // max 3000 chars (clamped by client)
 *   }>
 * }
 *
 * Returns:
 * {
 *   titles: Array<{ groupId: string, title: string }>
 * }
 */

const SYSTEM_PROMPT = `Generate a short, meaningful journal title (max 60 characters) for each journal entry below. Capture the main theme or emotion of the entry. Do NOT include the date in the title. Return ONLY a JSON array with no markdown fences or extra text.

Example response:
[{ "groupId": "g1", "title": "A Beautiful Day at the Park" }, { "groupId": "g2", "title": "Reflections on Friendship" }]`;

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
    const { journals } = body as {
      journals: Array<{ groupId: string; combinedText: string }>;
    };

    if (!journals || !Array.isArray(journals) || journals.length === 0) {
      return NextResponse.json(
        { error: 'journals array is required' },
        { status: 400 },
      );
    }

    if (journals.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 journals per request' },
        { status: 400 },
      );
    }

    // ── Build user message ───────────────────────────────────────────
    const userContent = journals
      .map(
        (j) =>
          `Journal (groupId: ${j.groupId}):\n${(j.combinedText || '').slice(0, 3000)}`,
      )
      .join('\n\n---\n\n');

    console.log(
      `[generate-titles] Generating titles for ${journals.length} journal(s) for user ${user.id}`,
    );

    // ── Call Claude API ──────────────────────────────────────────────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45_000); // 45s

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
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!anthropicResponse.ok) {
      const errBody = await anthropicResponse.json().catch(() => ({}));
      console.error('[generate-titles] Claude API error:', errBody);
      return NextResponse.json(
        {
          error: `Claude API error: ${anthropicResponse.status}`,
          detail: (errBody as { error?: { message?: string } })?.error
            ?.message,
        },
        { status: 502 },
      );
    }

    const claudeData = (await anthropicResponse.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const textBlock = claudeData.content?.find((c) => c.type === 'text');
    if (!textBlock?.text) {
      console.error(
        '[generate-titles] Unexpected Claude response:',
        claudeData,
      );
      return NextResponse.json(
        { error: 'Unexpected response from Claude' },
        { status: 502 },
      );
    }

    // ── Parse JSON ───────────────────────────────────────────────────
    let titles: Array<{ groupId: string; title: string }>;

    try {
      let raw = textBlock.text.trim();
      if (raw.startsWith('```')) {
        raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      titles = JSON.parse(raw);
    } catch {
      console.error(
        '[generate-titles] Failed to parse Claude JSON:',
        textBlock.text,
      );
      return NextResponse.json(
        {
          error: 'Failed to parse title generation results',
          rawResponse: textBlock.text,
        },
        { status: 502 },
      );
    }

    if (!Array.isArray(titles)) {
      return NextResponse.json(
        { error: 'Claude returned non-array result' },
        { status: 502 },
      );
    }

    // Sanitise — enforce max 60 chars, trim whitespace
    const sanitised = titles.map((t) => ({
      groupId: String(t.groupId),
      title: String(t.title || '').trim().slice(0, 60),
    }));

    console.log(
      `[generate-titles] Generated ${sanitised.length} title(s)`,
    );

    return NextResponse.json({ success: true, titles: sanitised });
  } catch (error) {
    console.error('[generate-titles] Error:', error);

    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Title generation timed out. Please try again.' },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate titles',
      },
      { status: 500 },
    );
  }
}
