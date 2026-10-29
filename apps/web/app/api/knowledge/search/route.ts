import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';

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
    for (let i = 0; i < embedding.length; i++) embedding[i] /= magnitude;
  }
  return embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (typeof ai === 'number' && typeof bi === 'number') {
      dot += ai * bi;
      nA += ai * ai;
      nB += bi * bi;
    }
  }
  return dot / (Math.sqrt(nA) * Math.sqrt(nB)) || 0;
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

/**
 * GET /api/knowledge/search?q=...&limit=10&type=memory|raw
 * 
 * Hybrid search: 
 * 1. First searches curated "memory" knowledge (high-confidence insights)
 * 2. Falls back to "raw" knowledge if memory results are insufficient
 * 3. Returns both layers separately for the consumer to format appropriately
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
    const typeFilter = searchParams.get('type'); // optional: 'memory' or 'raw'

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ error: 'Query too short' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const queryEmbedding = generateDeterministicEmbedding(query);

    // Fetch all active knowledge with embeddings for this user
    const { data: allKnowledge } = await adminClient
      .from('user_knowledge')
      .select('id, knowledge_type, category, content, confidence, evidence_count, embedding, first_seen_at, last_seen_at')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (!allKnowledge || allKnowledge.length === 0) {
      return NextResponse.json({ memory: [], raw: [], query });
    }

    // Score each knowledge item: semantic similarity * confidence weight
    const scored = allKnowledge.map(item => {
      let emb = item.embedding;
      if (typeof emb === 'string') emb = JSON.parse(emb);
      if (!Array.isArray(emb)) return { ...item, score: 0 };
      
      const similarity = cosineSimilarity(queryEmbedding, emb);
      // Weight by confidence: high-confidence items get a boost
      const score = similarity * (0.7 + 0.3 * (item.confidence || 0.5));
      return { ...item, score, similarity };
    }).filter(item => item.score > 0.15); // Minimum relevance threshold

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Split into memory and raw
    const memoryResults = scored
      .filter(item => item.knowledge_type === 'memory')
      .slice(0, limit)
      .map(({ id, category, content, confidence, evidence_count, score }) => ({
        id, category, content, confidence, evidence_count, score: Math.round(score * 100) / 100,
      }));

    const rawResults = scored
      .filter(item => item.knowledge_type === 'raw')
      .slice(0, limit)
      .map(({ id, category, content, confidence, score, first_seen_at, last_seen_at }) => ({
        id, category, content, confidence, score: Math.round(score * 100) / 100, first_seen_at, last_seen_at,
      }));

    // If typeFilter specified, return only that type
    if (typeFilter === 'memory') {
      return NextResponse.json({ memory: memoryResults, query });
    }
    if (typeFilter === 'raw') {
      return NextResponse.json({ raw: rawResults, query });
    }

    return NextResponse.json({
      memory: memoryResults,
      raw: rawResults,
      query,
      total: scored.length,
    });
  } catch (error) {
    console.error('[Knowledge Search] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
