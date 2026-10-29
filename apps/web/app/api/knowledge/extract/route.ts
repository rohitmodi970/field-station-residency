import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Reuse the same embedding function as journal-embeddings
function generateDeterministicEmbedding(text: string): number[] {
  const embedding = new Array(768).fill(0);
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  const uniqueWords = [...new Set(words)];

  for (let i = 0; i < uniqueWords.length && i < 256; i++) {
    const word = uniqueWords[i];
    if (!word) continue;
    const freq = words.filter(w => w === word).length / words.length;
    const hash = word.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
    const index = Math.abs(hash) % 256;
    embedding[index] += freq;
  }
  for (let i = 0; i < words.length - 1 && i < 256; i++) {
    const bigram = words[i] + ' ' + words[i + 1];
    const hash = bigram.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
    const index = 256 + (Math.abs(hash) % 256);
    embedding[index] += 0.5;
  }
  for (let i = 0; i < normalized.length - 2 && i < 256; i++) {
    const trigram = normalized.substring(i, i + 3);
    const hash = trigram.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
    const index = 512 + (Math.abs(hash) % 256);
    embedding[index] += 0.3;
  }
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  return embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) || 0;
}

async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return { error: 'Server misconfigured', status: 500 };
    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { error: 'Unauthorized', status: 401 };
    return { user };
  }
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: 'Unauthorized', status: 401 };
  return { user };
}

// Valid categories for knowledge items
const VALID_CATEGORIES = [
  'preference', 'relationship', 'goal', 'emotion_pattern',
  'life_event', 'health', 'value', 'behavior', 'temporal'
] as const;

/**
 * POST /api/knowledge/extract
 * Extracts knowledge from journal entry content and stores it.
 * 
 * Body: { entryId: string, content: string, title: string }
 * 
 * This is the core knowledge extraction pipeline:
 * 1. LLM extracts structured knowledge from entry
 * 2. Each item is checked against existing knowledge (dedup)
 * 3. New items are stored; existing items get confidence boosted
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;
    const { entryId, content, title } = await request.json();

    if (!content || !entryId) {
      return NextResponse.json({ error: 'Missing content or entryId' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Step 1: Extract knowledge using LLM
    const extracted = await extractKnowledge(content, title);
    if (!extracted || extracted.length === 0) {
      return NextResponse.json({ extracted: 0, updated: 0 });
    }

    // Step 2: Fetch existing active knowledge for deduplication
    const { data: existingKnowledge } = await adminClient
      .from('user_knowledge')
      .select('id, content, embedding, confidence, evidence_count, source_entry_ids, category, knowledge_type')
      .eq('user_id', user.id)
      .eq('is_active', true);

    // Step 3: For each extracted item, check similarity and upsert
    let newCount = 0;
    let updatedCount = 0;

    for (const item of extracted) {
      const itemEmbedding = generateDeterministicEmbedding(item.content);

      // Check if similar knowledge already exists (cosine sim > 0.85)
      let bestMatch: any = null;
      let bestSimilarity = 0;

      for (const existing of existingKnowledge || []) {
        if (existing.category !== item.category) continue;
        let existingEmb = existing.embedding;
        if (typeof existingEmb === 'string') {
          existingEmb = JSON.parse(existingEmb);
        }
        if (!Array.isArray(existingEmb)) continue;
        const sim = cosineSimilarity(itemEmbedding, existingEmb);
        if (sim > bestSimilarity) {
          bestSimilarity = sim;
          bestMatch = existing;
        }
      }

      if (bestMatch && bestSimilarity > 0.85) {
        // Update existing knowledge: boost confidence, add source entry
        const sourceIds = bestMatch.source_entry_ids || [];
        if (!sourceIds.includes(entryId)) {
          sourceIds.push(entryId);
        }
        const newConfidence = Math.min(1.0, bestMatch.confidence + 0.05);

        await adminClient
          .from('user_knowledge')
          .update({
            confidence: newConfidence,
            evidence_count: (bestMatch.evidence_count || 1) + 1,
            source_entry_ids: sourceIds,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', bestMatch.id);

        updatedCount++;
      } else {
        // Insert new knowledge
        await adminClient
          .from('user_knowledge')
          .insert({
            user_id: user.id,
            knowledge_type: item.knowledge_type,
            category: item.category,
            content: item.content,
            confidence: item.confidence,
            source_entry_ids: [entryId],
            embedding: itemEmbedding,
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            valid_from: item.valid_from || null,
          });
        newCount++;
      }
    }

    console.log(`[Knowledge] Extracted ${extracted.length} items, ${newCount} new, ${updatedCount} updated for user ${user.id}`);
    return NextResponse.json({ extracted: extracted.length, new: newCount, updated: updatedCount });
  } catch (error) {
    console.error('[Knowledge] Extraction error:', error);
    return NextResponse.json({ error: 'Failed to extract knowledge' }, { status: 500 });
  }
}

/**
 * GET /api/knowledge/extract?type=memory|raw&category=...&limit=20
 * Retrieves stored knowledge for a user.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const adminClient = createAdminClient();
    let query = adminClient
      .from('user_knowledge')
      .select('id, knowledge_type, category, content, confidence, evidence_count, first_seen_at, last_seen_at, valid_from, valid_until, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('confidence', { ascending: false })
      .order('last_seen_at', { ascending: false })
      .limit(limit);

    if (type) query = query.eq('knowledge_type', type);
    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) {
      console.error('[Knowledge] Fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch knowledge' }, { status: 500 });
    }

    return NextResponse.json({ knowledge: data || [] });
  } catch (error) {
    console.error('[Knowledge] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge' }, { status: 500 });
  }
}

/**
 * Core LLM extraction: takes journal content and returns structured knowledge items.
 * 
 * Key design decisions:
 * - "memory" items: high-level insights safe to show users (preferences, values, patterns)
 * - "raw" items: specific details for AI context (quotes, events, temporal facts)
 * - Each item is short (1-2 sentences) to enable precise deduplication
 * - Categories enable targeted retrieval for different query types
 */
async function extractKnowledge(
  content: string, 
  title: string
): Promise<Array<{
  knowledge_type: 'memory' | 'raw';
  category: string;
  content: string;
  confidence: number;
  valid_from?: string;
}>> {
  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Extract knowledge from this journal entry. Return structured facts about the user.

ENTRY TITLE: "${title}"
ENTRY CONTENT: "${content.substring(0, 2000)}"

Extract TWO types of knowledge:

TYPE 1 - "memory" (curated insights, shown to user):
- Stable preferences and values (e.g., "Values deep conversations over small talk")
- Relationship patterns (e.g., "Close with sister Maya, talks weekly")
- Life goals (e.g., "Working toward starting own business")
- Recurring emotional patterns (e.g., "Energized by creative work, drained by routine tasks")
- Health patterns (e.g., "Runs 3x/week, sleep improves with exercise")

TYPE 2 - "raw" (detailed context, for AI only):
- Specific events with dates/times (e.g., "Had argument with boss on Jan 15")
- Exact quotes or phrases they used (e.g., "Described feeling 'stuck in a loop'")
- Temporal facts (e.g., "Started meditation practice this week")
- Behavioral observations (e.g., "Tends to journal more when stressed")

RULES:
- Each item must be ONE concise sentence (max 30 words)
- Extract 3-8 items total (mix of memory and raw)
- SKIP generic observations ("had a normal day", "felt okay")
- PREFER specific, unique facts over vague patterns
- For preferences, state them as facts not observations ("Prefers..." not "Seems to prefer...")
- For temporal facts, include time references when available

Categories: preference, relationship, goal, emotion_pattern, life_event, health, value, behavior, temporal

Return ONLY valid JSON array:
[
  {"knowledge_type": "memory"|"raw", "category": "...", "content": "...", "confidence": 0.5-0.9}
]

Use confidence:
- 0.9: Explicit statement by user ("I love hiking")
- 0.7: Strong inference ("Mentions hiking in 4 entries" → likes hiking)
- 0.5: Tentative observation (single mention, could be one-off)`
      }]
    });

    const text = (response.content[0] as any)?.text?.trim() || '[]';
    
    // Parse JSON, handling potential code fences
    let jsonStr = text;
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    
    const items = JSON.parse(jsonStr);
    
    // Validate and filter
    return items.filter((item: any) => {
      if (!item.content || !item.category || !item.knowledge_type) return false;
      if (!VALID_CATEGORIES.includes(item.category as any)) return false;
      if (!['memory', 'raw'].includes(item.knowledge_type)) return false;
      if (item.content.length > 200) return false; // Reject overly long items
      return true;
    }).map((item: any) => ({
      knowledge_type: item.knowledge_type,
      category: item.category,
      content: item.content,
      confidence: Math.min(0.9, Math.max(0.5, item.confidence || 0.7)),
      valid_from: item.valid_from || undefined,
    }));
  } catch (error) {
    console.error('[Knowledge] LLM extraction error:', error);
    return [];
  }
}
