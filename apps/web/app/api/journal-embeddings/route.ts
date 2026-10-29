import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import { deriveKeyFromPassword, decryptText, base64ToUint8Array, importMasterKey } from '@/utils/encryption/crypto';
import { serverEncryptJournalEmbedding } from '@/utils/encryption/aiDataEncryption';
import { parsePublicKeyFromDb } from '@/utils/encryption/hybridCrypto';
import Anthropic from '@anthropic-ai/sdk';
import { resolveJournalContent } from '@/utilities/journalTitle';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Authenticate from cookies (web) OR Bearer token (mobile).
 */
async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { error: 'Server misconfigured', status: 500 };
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { error: 'Unauthorized', status: 401 };
    }
    return { user };
  }

  // Fall back to cookie-based auth (web)
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user };
}

interface JournalEmbedding {
  id: string;
  entry_id: string;
  embedding: number[];
  created_at: string;
}

interface SimilarityMatch {
  entry_id: string;
  similarity: number;
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA: number[] | undefined, vecB: number[] | undefined): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += (vecA[i] ?? 0) * (vecB[i] ?? 0);
    normA += (vecA[i] ?? 0) * (vecA[i] ?? 0);
    normB += (vecB[i] ?? 0) * (vecB[i] ?? 0);
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (normA * normB);
}

function clampSimilarity(value: number): number | null {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

// Generate deterministic 768-dimensional embedding from text
function generateDeterministicEmbedding(text: string): number[] {
  const embedding = new Array(768).fill(0);
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  
  // Extract words and bigrams for better semantic representation
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  const uniqueWords = [...new Set(words)];
  
  // Word frequency features (first 256 dimensions)
  for (let i = 0; i < uniqueWords.length && i < 256; i++) {
    const word = uniqueWords[i];
    if (!word) continue;
    const freq = words.filter(w => w === word).length / words.length;
    const hash = word.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
    const index = Math.abs(hash) % 256;
    embedding[index] += freq;
  }
  
  // Bigram features (next 256 dimensions)
  for (let i = 0; i < words.length - 1 && i < 256; i++) {
    const bigram = words[i] + ' ' + words[i + 1];
    const hash = bigram.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
    const index = 256 + (Math.abs(hash) % 256);
    embedding[index] += 0.5;
  }
  
  // Character n-gram features (last 256 dimensions)
  for (let i = 0; i < normalized.length - 2 && i < 256; i++) {
    const trigram = normalized.substring(i, i + 3);
    const hash = trigram.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
    const index = 512 + (Math.abs(hash) % 256);
    embedding[index] += 0.3;
  }
  
  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

// Generate embedding using deterministic method (fast, no API calls)
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use deterministic embedding for consistency and speed
    return generateDeterministicEmbedding(text);
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Extract a unique significant keyword from journal content using LLM
async function extractKeyword(content: string, existingKeywords: string[]): Promise<string> {
  const fallbackKeywordFromContent = (text: string): string => {
    const tokens = text
      .replace(/[\n\r]/g, ' ')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter(w => w.length > 3)
      .slice(0, 4);
    const candidate = tokens.join(' ').trim();
    return candidate.length > 0 ? candidate.substring(0, 40) : 'Journal Moment';
  };

  const isInvalidKeyword = (value: string): boolean => {
    const k = (value || '').trim().toLowerCase();
    if (!k) return true;
    if (k.length > 45) return true;
    if (/^\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}$/.test(k)) return true;
    if (k === 'entry' || k === 'journal entry' || k === 'daily reflection') return true;
    const blockedPhrases = [
      'i apologize',
      'cannot',
      "can't",
      'without',
      'please paste',
      'journal entry text',
      'request',
      'unable to',
      'analysis',
      'error',
      'failed',
    ];
    return blockedPhrases.some(p => k.includes(p));
  };

  try {
    const existingKeywordsList = existingKeywords.length > 0 
      ? `\n\nExisting keywords already in use (MUST generate a DIFFERENT one): ${existingKeywords.join(', ')}`
      : '';
    
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Extract a short, memorable phrase (2-4 words) that uses the user's OWN WORDS from this journal entry. Pick the most vivid or specific phrase that appears in the text — a person's name, a place, an activity, or a feeling they described.

RULES:
- PREFER phrases that actually appear in the entry text (quoted or paraphrased)
- NEVER use dates, days, months, or time references
- NEVER use generic labels like "daily reflection" or "personal thoughts"
- Focus on what makes THIS entry unique${existingKeywordsList}

Journal entry:
"${content.substring(0, 500)}"

Respond with ONLY the phrase, nothing else.`
      }]
    });

    let keyword = (response.content[0] as any)?.text?.trim() || 'Entry';
    
    // Reject date-like keywords — if the LLM returned a date, derive from content instead
    const datePattern = /^(\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[\w\s,]*\d{0,4})$/i;
    if (datePattern.test(keyword) || isInvalidKeyword(keyword)) {
      keyword = fallbackKeywordFromContent(content);
    }
    
    console.log('[Embedding] Extracted keyword:', keyword);
    return keyword;
  } catch (error) {
    console.error('[Embedding] Error extracting keyword:', error);
    return fallbackKeywordFromContent(content);
  }
}

// Valid mindmap categories
const VALID_CATEGORIES = ['people', 'work', 'health', 'emotions', 'learning', 'hobbies', 'places', 'goals', 'events', 'daily'] as const;
type Category = typeof VALID_CATEGORIES[number];

// Extract category from journal content using LLM (stored permanently)
async function extractCategory(content: string, title: string): Promise<Category> {
  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Categorize this journal entry by its PRIMARY theme. Choose ONE category.

Available categories:
- people: Relationships, family, friends, social interactions
- work: Career, job, professional matters, business
- health: Physical health, exercise, medical, wellness
- emotions: Feelings, mood, mental state, emotional experiences
- learning: Education, skills, knowledge, personal growth
- hobbies: Leisure activities, interests, fun, entertainment
- places: Travel, locations, nature, environment
- goals: Aspirations, plans, achievements, targets
- events: Special occasions, celebrations, milestones
- daily: Everyday routines, mundane activities, general life

Title: "${title}"
Content: "${content.substring(0, 300)}"

Respond with ONLY the category name (one word), nothing else.`
      }]
    });

    const categoryResponse = (response.content[0] as any)?.text?.trim().toLowerCase() || 'daily';
    const category = VALID_CATEGORIES.includes(categoryResponse as Category) ? categoryResponse as Category : 'daily';
    console.log('[Embedding] Extracted category:', category);
    return category;
  } catch (error) {
    console.error('[Embedding] Error extracting category:', error);
    return 'daily';
  }
}

// Generate connection reason between two journal entries using LLM
async function generateConnectionReason(
  sourceTitle: string, 
  sourceContent: string, 
  targetTitle: string, 
  targetContent: string,
  similarity: number
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Analyze the thematic connection between two journal entries.

ENTRY A: "${sourceTitle}"
${sourceContent.substring(0, 300)}

ENTRY B: "${targetTitle}"
${targetContent.substring(0, 300)}

Similarity: ${(similarity * 100).toFixed(0)}%

Write ONE pattern phrase (8-15 words) describing the connecting thread. Use the format: "[thing from A] evolving into/leading to/meeting [thing from B]"

RULES:
- NO generic phrases like "both discuss" or "similar themes"
- Reference SPECIFIC content from each entry
- Show a direction or evolution, not just overlap
- Use the user's actual words or situations when possible

Pattern phrase:`
      }]
    });

    const reason = (response.content[0] as any)?.text?.trim() || 'Thematic patterns evolving across reflections';
    console.log(`[Embedding] Pattern flow (${sourceTitle} → ${targetTitle}):`, reason);
    return reason;
  } catch (error) {
    console.error('[Embedding] Error generating connection reason:', error);
    return 'Thematic patterns evolving across reflections';
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    // Use admin client for all DB queries — auth is already verified above.
    const supabase = createAdminClient();

    const body = await request.json();
    const { entryId, content, transcript, resolved_content, title = '', threshold = 0.55 } = body;
    const analysisContent = resolveJournalContent({
      content: resolved_content || content,
      transcript,
    }).value;

    if (!entryId || !analysisContent) {
      return NextResponse.json(
        { error: 'entryId and content are required' },
        { status: 400 }
      );
    }

    // Generate embedding for the new entry
    const embedding = await generateEmbedding(analysisContent);

    // Fetch existing keywords for uniqueness check
    const { data: existingEmbeddingsWithKeywords } = await supabase
      .from('journal_embeddings')
      .select('keyword')
      .eq('user_id', user.id)
      .neq('entry_id', entryId)
      .not('keyword', 'is', null);

    const existingKeywords = (existingEmbeddingsWithKeywords || [])
      .map(e => e.keyword)
      .filter(k => k && k.trim().length > 0);

    // Fetch user's public key
    const { data: userData } = await supabase
      .from('users')
      .select('encryption_public_key')
      .eq('id', user.id)
      .single();
    const pubKey = parsePublicKeyFromDb(userData?.encryption_public_key);

    // Extract unique keyword and category using LLM (done once, stored permanently)
    const [keyword, category] = await Promise.all([
      extractKeyword(analysisContent, existingKeywords),
      extractCategory(analysisContent, title)
    ]);

    let insertRow: any = {
      entry_id: entryId,
      user_id: user.id,
      embedding: embedding,
      updated_at: new Date().toISOString()
    };

    if (pubKey) {
      const enc = await serverEncryptJournalEmbedding(keyword, category, pubKey);
      insertRow = { ...insertRow, ...enc };
    } else {
      insertRow.keyword = keyword;
      insertRow.category = category;
    }

    // Store the embedding with keyword and category (handle case when table doesn't exist yet)
    const { error: insertError } = await supabase
      .from('journal_embeddings')
      .upsert(insertRow, {
        onConflict: 'entry_id'
      });

    if (insertError) {
      if (insertError.code === 'PGRST205') {
        console.warn('journal_embeddings table not found. Please run the database migration.');
        return NextResponse.json({
          success: false,
          message: 'Database tables not created. Please run migration.',
          entryId,
          similarEntries: [],
          edgesCreated: 0
        });
      }
      console.error('Error storing embedding:', insertError);
      return NextResponse.json(
        { error: 'Failed to store embedding' },
        { status: 500 }
      );
    }

    // Fetch all embeddings for the user
    const { data: existingEmbeddings, error: fetchError } = await supabase
      .from('journal_embeddings')
      .select('entry_id, embedding')
      .eq('user_id', user.id)
      .neq('entry_id', entryId);

    if (fetchError) {
      console.error('Error fetching embeddings:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch embeddings' },
        { status: 500 }
      );
    }

    // Calculate similarities
    const similarities: SimilarityMatch[] = [];
    
    for (const existing of existingEmbeddings || []) {
      // Parse embedding if it's a string (PostgreSQL vector type returns as string)
      let existingEmb = existing.embedding;
      if (typeof existingEmb === 'string') {
        existingEmb = JSON.parse(existingEmb.replace(/^\[/, '[').replace(/\]$/, ']'));
      }
      
      if (!Array.isArray(existingEmb)) continue;
      
      const similarityRaw = cosineSimilarity(embedding, existingEmb);
      const similarity = clampSimilarity(similarityRaw);

      if (similarity === null) {
        continue;
      }
      
      if (similarity >= threshold) {
        similarities.push({
          entry_id: existing.entry_id,
          similarity: similarity
        });
      }
    }

    // Generate connection reasons for similar entries
    // First, fetch the journal entries to get their titles and content
    let edges: any[] = [];
    
    if (similarities.length > 0) {
      const similarEntryIds = similarities.map(s => s.entry_id);
      
      const { data: journalEntries } = await supabase
        .from('journals')
        .select('id, title, content')
        .in('id', similarEntryIds);
      
      const entriesMap = new Map((journalEntries || []).map(e => [e.id, e]));
      
      // Generate connection reasons for each similar entry (in parallel for speed)
      const edgePromises = similarities.map(async (match) => {
        const safeSimilarity = clampSimilarity(match.similarity);
        if (safeSimilarity === null) {
          return null;
        }
        const targetEntry = entriesMap.get(match.entry_id);
        const targetTitle = targetEntry?.title || 'Untitled';
        const targetContent = targetEntry?.content || '';
        
        // Generate the connection reason using LLM
        const connectionReason = await generateConnectionReason(
          title,
          content,
          targetTitle,
          targetContent,
          match.similarity
        );
        
        return {
          source_entry_id: entryId,
          target_entry_id: match.entry_id,
          similarity: safeSimilarity,
          connection_reason: connectionReason,
          user_id: user.id,
          created_at: new Date().toISOString()
        };
      });

      edges = (await Promise.all(edgePromises)).filter((edge): edge is NonNullable<typeof edge> => !!edge);
      
      // Store edges with connection reasons
      const { error: edgeError } = await supabase
        .from('journal_edges')
        .upsert(edges, {
          onConflict: 'source_entry_id,target_entry_id'
        });

      if (edgeError) {
        console.error('Error storing edges:', edgeError);
      }
    }

    return NextResponse.json({
      success: true,
      entryId,
      similarEntries: similarities,
      edgesCreated: edges.length
    });

  } catch (error) {
    console.error('Embedding API error:', error);
    return NextResponse.json(
      { error: 'Failed to process embedding' },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch mindmap data for a user
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    // Use admin client for all DB queries — auth is already verified above.
    // The cookie-based client doesn't work for Bearer-token requests from mobile.
    const adminClient = createAdminClient();

    const { searchParams } = new URL(request.url);
    const entryIdsParam = searchParams.get('entryIds');
    const entryIds = entryIdsParam ? entryIdsParam.split(',').filter(id => id && id.trim()) : [];

    // Get user's encryption data for decryption
    const { data: userData } = await adminClient
      .from('users')
      .select('encryption_salt, encrypted_master_key, master_key_iv, key_version')
      .eq('id', user.id)
      .single();

    // Decrypt master key if available.
    // Only attempt server-side decrypt for legacy key_version = 1.
    // key_version >= 2 uses a random credential stored only in the user's IndexedDB —
    // the server cannot decrypt it. Mindmap still works because keyword and category
    // are stored as plaintext in journal_embeddings (set at embedding-creation time).
    let masterKey: CryptoKey | null = null;
    const keyVersion = userData?.key_version ?? 1;

    if (
      keyVersion <= 1 &&
      userData?.encryption_salt &&
      userData?.encrypted_master_key &&
      userData?.master_key_iv
    ) {
      try {
        const salt = base64ToUint8Array(userData.encryption_salt);
        const passwordKey = await deriveKeyFromPassword(user.id, salt);
        const masterKeyBase64 = await decryptText(
          userData.encrypted_master_key,
          userData.master_key_iv,
          passwordKey
        );
        const masterKeyBytes = base64ToUint8Array(masterKeyBase64);
        masterKey = await importMasterKey(masterKeyBytes);
      } catch (error) {
        console.error('[Mindmap] Failed to decrypt master key:', error);
      }
    } else if (keyVersion >= 2) {
      console.log('[Mindmap] key_version=2 — skipping server-side decrypt; using stored keywords/categories.');
    }

    // Fetch journal entries
    let entriesQuery = adminClient
      .from('journals')
      .select('id, journal_id, title, title_encrypted, title_iv, content, content_encrypted, content_iv, display_date, tags, is_encrypted')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('display_date', { ascending: false});

    if (entryIds.length > 0) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const uuidIds = entryIds.filter(id => uuidRegex.test(id));
      
      const orClauses: string[] = [`journal_id.in.(${entryIds.join(',')})`];
      if (uuidIds.length > 0) {
        orClauses.push(`id.in.(${uuidIds.join(',')})`);
      }
      entriesQuery = entriesQuery.or(orClauses.join(','));
    }

    const { data: entries, error: entriesError } = await entriesQuery;

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return NextResponse.json(
        { error: 'Failed to fetch entries' },
        { status: 500 }
      );
    }

    // Decrypt titles if encrypted
    const decryptedEntries = await Promise.all(
      (entries || []).map(async (entry: any) => {
        let title = entry.title || '';
        let content = entry.content || '';
        
        if (entry.is_encrypted && masterKey) {
          // Decrypt title
          if (entry.title_encrypted && entry.title_iv) {
            try {
              title = await decryptText(entry.title_encrypted, entry.title_iv, masterKey);
            } catch (error) {
              console.error('[Mindmap] Failed to decrypt title:', error);
            }
          }
          
          // Decrypt content for LLM categorization
          if (entry.content_encrypted && entry.content_iv) {
            try {
              content = await decryptText(entry.content_encrypted, entry.content_iv, masterKey);
            } catch (error) {
              console.error('[Mindmap] Failed to decrypt content:', error);
            }
          }
        }
        
        return {
          ...entry,
          title,
          content
        };
      })
    );

    // Fetch edges (handle case when table doesn't exist yet)
    let edges: any[] = [];
    
    // Fetch keywords and categories from embeddings table
    let keywordsMap = new Map<string, string>();
    let categoriesMap = new Map<string, string>();
    
    try {
      const { data: embeddingsData } = await adminClient
        .from('journal_embeddings')
        .select('entry_id, keyword, category, keyword_encrypted, keyword_iv, category_encrypted, category_iv, is_encrypted')
        .eq('user_id', user.id);
      
      if (embeddingsData) {
        embeddingsData.forEach((emb: any) => {
          if (emb.is_encrypted) {
            keywordsMap.set(emb.entry_id, {
              is_encrypted: true,
              keyword_encrypted: emb.keyword_encrypted,
              keyword_iv: emb.keyword_iv,
            } as any);
            categoriesMap.set(emb.entry_id, {
              is_encrypted: true,
              category_encrypted: emb.category_encrypted,
              category_iv: emb.category_iv,
            } as any);
          } else {
            if (emb.keyword) keywordsMap.set(emb.entry_id, emb.keyword);
            if (emb.category) categoriesMap.set(emb.entry_id, emb.category);
          }
        });
        console.log(`[Mindmap] Found embeddings data for user`);
      }
    } catch (err) {
      console.error('Error fetching keywords/categories:', err);
    }
    
    try {
      // First get the mapping of journal_id to id
      const idMap = new Map((decryptedEntries || []).map((e: any) => [e.journal_id, e.id]));
      const dbIds = Array.from(idMap.values());

      let edgesQuery = adminClient
        .from('journal_edges')
        .select('source_entry_id, target_entry_id, similarity, connection_reason')
        .eq('user_id', user.id);

      if (dbIds.length > 0) {
        edgesQuery = edgesQuery.or(`source_entry_id.in.(${dbIds.join(',')}),target_entry_id.in.(${dbIds.join(',')})`);
      }

      const { data: edgesData, error: edgesError } = await edgesQuery;

      if (edgesError) {
        // If table doesn't exist, log and continue with empty edges
        if (edgesError.code === 'PGRST205') {
          console.warn('journal_edges table not found. Please run the database migration.');
        } else {
          console.error('Error fetching edges:', edgesError);
        }
      } else {
        edges = edgesData || [];
        console.log(`[Mindmap] Found ${edges.length} edges for user`);
      }
    } catch (err) {
      console.error('Error querying edges:', err);
    }

    // Helper: derive a short label from content when no keyword or title exists
    const deriveLabel = (content: string | undefined): string => {
      if (!content) return 'Journal Entry';
      // Take first meaningful words (skip very short words at the start)
      const cleaned = content.replace(/[#*_>\-\[\]()]/g, '').trim();
      const words = cleaned.split(/\s+/).filter(w => w.length > 0);
      // Take first 3-5 words that form a readable snippet
      const snippet = words.slice(0, 4).join(' ');
      if (snippet.length > 30) return snippet.substring(0, 27) + '...';
      return snippet || 'Journal Entry';
    };

    // Use stored categories from embeddings table (no LLM calls needed)
    // Categories are now assigned once during embedding creation for consistency
    const isUsableNodeKeyword = (value: string | undefined): boolean => {
      if (!value) return false;
      const normalized = value.trim().toLowerCase();
      if (!normalized) return false;
      if (normalized.length > 45) return false;
      const blocked = [
        'i apologize',
        'cannot',
        "can't",
        'without',
        'please paste',
        'journal entry text',
        'unable to',
        'error',
        'failed',
      ];
      return !blocked.some(token => normalized.includes(token));
    };

    const nodes = (decryptedEntries || []).map((entry: any) => {
      const keywordData = keywordsMap.get(entry.id);
      const categoryData = categoriesMap.get(entry.id);

      const hasRealTitle = entry.title && !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(entry.title.trim()) && !/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(entry.title.trim());
      const title = hasRealTitle ? entry.title : deriveLabel(entry.content);
      
      const isEncrypted = (keywordData as any)?.is_encrypted;
      
      // Compute fallback plaintext display if unencrypted
      let displayLabel = title;
      if (!isEncrypted) {
         displayLabel = isUsableNodeKeyword(keywordData as string) ? (keywordData as string) : title;
      }
      const category = !isEncrypted && categoryData ? (categoryData as string) : 'daily';

      console.log(`[Node] ${entry.journal_id.substring(0, 8)}: ${category} (stored)`);
      return {
        id: entry.id,
        journal_id: entry.journal_id,
        label: displayLabel,
        title: title, // Store original title for popover
        category: category,
        description: `**${title}**\n\n${entry.content?.substring(0, 150)}${entry.content?.length > 150 ? '...' : ''}`,
        is_encrypted: isEncrypted,
        keyword_encrypted: (keywordData as any)?.keyword_encrypted,
        keyword_iv: (keywordData as any)?.keyword_iv,
        category_encrypted: (categoryData as any)?.category_encrypted,
        category_iv: (categoryData as any)?.category_iv,
      };
    });

    // Create a set of valid node IDs (database IDs, not journal_ids)
    const validNodeIds = new Set(nodes.map(n => n.id));
    
    // Create a map of node IDs to labels for connection display
    const nodeLabelsMap = new Map(nodes.map(n => [n.id, n.label]));

    // Transform edges to links, filtering out edges where nodes don't exist
    const links = edges
      .filter(edge => {
        const sourceExists = validNodeIds.has(edge.source_entry_id);
        const targetExists = validNodeIds.has(edge.target_entry_id);
        
        if (!sourceExists || !targetExists) {
          console.log(`[Mindmap] Filtering out edge: source=${edge.source_entry_id} (exists: ${sourceExists}), target=${edge.target_entry_id} (exists: ${targetExists})`);
        }
        
        return sourceExists && targetExists;
      })
      .map(edge => ({
        source: edge.source_entry_id,
        target: edge.target_entry_id,
        similarity: edge.similarity,
        connectionReason: edge.connection_reason || 'Similar content',
        sourceLabel: nodeLabelsMap.get(edge.source_entry_id) || 'Entry',
        targetLabel: nodeLabelsMap.get(edge.target_entry_id) || 'Entry'
      }));

    console.log(`[Mindmap] Returning ${nodes.length} nodes and ${links.length} links (filtered from ${edges.length} edges)`);

    return NextResponse.json({
      nodes,
      links,
      message: links.length === 0 ? 'Run database migration to enable connections' : undefined
    });

  } catch (error) {
    console.error('Mindmap GET API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mindmap data' },
      { status: 500 }
    );
  }
}
