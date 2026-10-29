import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin';
import { deriveKeyFromPassword, decryptText, base64ToUint8Array, importMasterKey } from '@/utils/encryption/crypto';
import { serverEncryptJournalEmbedding } from '@/utils/encryption/aiDataEncryption';
import { parsePublicKeyFromDb } from '@/utils/encryption/hybridCrypto';
import Anthropic from '@anthropic-ai/sdk';
import { resolveJournalContent } from '@/utilities/journalTitle';

// Increase function timeout to 5 minutes for batch processing
export const maxDuration = 300;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Generate embedding using Claude (simulated via text analysis)
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use Claude to generate a semantic representation
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyze this text and return exactly 768 floating-point numbers between -1 and 1 representing its semantic embedding. Return ONLY the numbers separated by commas, no other text:\n\n${text.substring(0, 1000)}`
      }]
    });

    const content = response.content[0];
    if (!content || content.type !== 'text') {
      return generateDeterministicEmbedding(text);
    }
    
    const numbers = content.text.split(',').map((n: string) => parseFloat(n.trim())).filter((n: number) => !isNaN(n));
    
    // If we don't get exactly 768 numbers, generate deterministic embeddings from text
    if (numbers.length !== 768) {
      return generateDeterministicEmbedding(text);
    }
    
    return numbers;
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Fallback to deterministic embedding
    return generateDeterministicEmbedding(text);
  }
}

// Extract significant keywords from journal content using LLM
async function extractKeyword(text: string, existingKeywords: string[] = []): Promise<string> {
  try {
    const existingKeywordsList = existingKeywords.length > 0 
      ? `\n\nExisting keywords already in use (MUST generate a DIFFERENT one): ${existingKeywords.join(', ')}`
      : '';
    
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Extract a unique 2-4 word phrase that best captures the main theme of this journal entry.${existingKeywordsList}\n\n${text.substring(0, 500)}\n\nReturn ONLY the keywords, nothing else.`
      }]
    });

    const content = response.content[0];
    if (content && content.type === 'text') {
      return content.text.trim();
    }
    return 'Journal Entry';
  } catch (error) {
    console.error('Error extracting keyword:', error);
    return 'Journal Entry';
  }
}

// Valid mindmap categories
const VALID_CATEGORIES = ['people', 'work', 'health', 'emotions', 'learning', 'hobbies', 'places', 'goals', 'events', 'daily'] as const;
type Category = typeof VALID_CATEGORIES[number];

// Extract category from journal content using LLM
async function extractCategory(content: string, title: string): Promise<Category> {
  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Categorize this journal entry by its PRIMARY theme. Choose ONE category.

Available categories: people, work, health, emotions, learning, hobbies, places, goals, events, daily

Title: "${title}"
Content: "${content.substring(0, 300)}"

Respond with ONLY the category name (one word), nothing else.`
      }]
    });

    const categoryResponse = (response.content[0] as { type: string; text: string })?.text?.trim().toLowerCase() || 'daily';
    return VALID_CATEGORIES.includes(categoryResponse as Category) ? categoryResponse as Category : 'daily';
  } catch (error) {
    console.error('[Batch] Error extracting category:', error);
    return 'daily';
  }
}

// Generate connection reason between two journal entries
async function generateConnectionReason(
  sourceTitle: string, 
  sourceContent: string, 
  targetTitle: string, 
  targetContent: string
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Describe the underlying PATTERN that connects these journal entries. Don't mention "both" or "entries" - describe the pattern itself.

FIRST: "${sourceTitle}"
${sourceContent.substring(0, 600)}

SECOND: "${targetTitle}"
${targetContent.substring(0, 600)}

Find DIFFERENT aspects that create a thematic bridge:
- Emotional evolution: fear → acceptance
- Behavioral shift: resistance → engagement  
- Value exploration: independence ↔ connection
- Pattern recognition: chaos discovering structure

DON'T use: "Both", "entries share", "connected through"
DO describe: The pattern itself as it flows

Provide ONE elegant pattern (12-20 words):

Good:
✓ "Work pressure and overwhelm transforming into boundary awareness and self-advocacy"
✓ "Creative frustration evolving through experimentation into renewed purpose"

Bad:
✗ "Both discuss stress"
✗ "Share work themes"

Pattern:`
      }]
    });

    const reason = (response.content[0] as { type: string; text: string })?.text?.trim() || 'Thematic patterns evolving across reflections';
    return reason;
  } catch (error) {
    console.error('[Batch] Error generating connection reason:', error);
    return 'Thematic patterns evolving across reflections';
  }
}

// Fallback: Generate deterministic 768-dimensional embedding from text
function generateDeterministicEmbedding(text: string): number[] {
  const embedding = new Array(768).fill(0);
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  
  // Extract words and bigrams for better semantic representation
  const words = normalized.split(/\s+/).filter(w => w.length > 2);
  const uniqueWords = [...new Set(words)];
  
  console.log(`[Embedding] Text length: ${text.length}, Words: ${words.length}, Unique: ${uniqueWords.length}`);
  
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
  console.log(`[Embedding] Magnitude before normalization: ${magnitude}`);
  
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  const nonZero = embedding.filter(v => v !== 0).length;
  console.log(`[Embedding] Non-zero dimensions: ${nonZero}`);
  
  return embedding;
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
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

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    // Get limit and offset from query params
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '0');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const resetParam = (url.searchParams.get('reset') || '').toLowerCase();
    const shouldReset = resetParam
      ? (resetParam === '1' || resetParam === 'true' || resetParam === 'yes')
      : offset === 0;
    
    console.log(`[Batch Embeddings] Starting batch generation for user: ${user.id}${limit > 0 ? ` (limit: ${limit}, offset: ${offset})` : ' (all entries)'}`);

    // Get user's encryption data for decryption (master key system)
    const adminClient = createAdminClient();
    const { data: userData } = await adminClient
      .from('users')
      .select('encryption_salt, encrypted_master_key, master_key_iv, key_version, encryption_public_key')
      .eq('id', user.id)
      .single();
    
    const pubKey = parsePublicKeyFromDb(userData?.encryption_public_key);

    // Only attempt server-side decrypt for legacy key_version = 1.
    // key_version >= 2 uses a random credential stored only in the user's IndexedDB —
    // the server can never decrypt it. All encrypted entries will be skipped below.
    // To generate embeddings for key_version >= 2 users, trigger the batch from the
    // client (which can decrypt locally) using the POST /api/journal-embeddings endpoint.
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
        console.log('[Batch] Successfully decrypted master key (key_version=1)');
      } catch (error) {
        console.error('[Batch] Failed to decrypt master key:', error);
      }
    } else if (keyVersion >= 2) {
      console.log('[Batch] key_version=2 — server-side decrypt not possible. Encrypted entries will be skipped. Use client-triggered per-entry embedding (POST /api/journal-embeddings) for key_version=2 users.');
    }

    // Fetch user's journal entries (with optional limit/offset)
    let query = adminClient
      .from('journals')
      .select('id, journal_id, title, title_encrypted, title_iv, content, content_encrypted, content_iv, voice_transcript_encrypted, voice_transcript_iv, is_encrypted')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    
    if (limit > 0) {
      query = query.range(offset, offset + limit - 1);
    }
    
    const { data: journals, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching journals:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch journals' }, { status: 500 });
    }

    if (!journals || journals.length === 0) {
      return NextResponse.json({ 
        message: 'No journals found',
        processed: 0,
        skipped: 0,
        edgesCreated: 0
      });
    }

    console.log(`[Batch Embeddings] Found ${journals.length} journals to process`);

    // Clear existing embeddings/edges only for explicit reset (or first batch by default).
    if (shouldReset) {
      console.log('[Batch] Clearing old embeddings and edges...');
      await adminClient.from('journal_edges').delete().eq('user_id', user.id);
      await adminClient.from('journal_embeddings').delete().eq('user_id', user.id);
      console.log('[Batch] Old data cleared, starting fresh generation');
    } else {
      console.log('[Batch] Incremental mode: keeping existing embeddings/edges and appending this batch');
    }

    let processed = 0;
    let skipped = 0;
    let totalEdges = 0;
    const threshold = 0.56; // Threshold for deterministic embeddings
    const existingKeywords: string[] = []; // Track used keywords for uniqueness
    
    // Store journal content for connection reason generation
    const journalContentMap = new Map<string, { title: string; content: string }>();

    // Process each journal
    for (const journal of journals) {
      try {
        // Decrypt content if encrypted and we have the master key
        let content = '';
        let title = '';
        let voiceTranscript = '';
        
        if (journal.is_encrypted && masterKey) {
          // Decrypt title
          if (journal.title_encrypted && journal.title_iv) {
            try {
              title = await decryptText(journal.title_encrypted, journal.title_iv, masterKey);
            } catch (titleError) {
              console.error(`[Batch] Failed to decrypt title for ${journal.journal_id}`);
            }
          }
          
          // Decrypt content
          if (journal.content_encrypted && journal.content_iv) {
            try {
              content = await decryptText(journal.content_encrypted, journal.content_iv, masterKey);
              console.log(`[Batch] Successfully decrypted journal ${journal.journal_id}`);
            } catch (decryptError) {
              console.error(`[Batch] Failed to decrypt journal ${journal.journal_id}:`, decryptError);
              if (!title) {
                skipped++;
                continue;
              }
              content = title; // Use title as fallback
            }
          }

          if (journal.voice_transcript_encrypted && journal.voice_transcript_iv) {
            try {
              voiceTranscript = await decryptText(journal.voice_transcript_encrypted, journal.voice_transcript_iv, masterKey);
            } catch (decryptVoiceError) {
              console.error(`[Batch] Failed to decrypt transcript for ${journal.journal_id}:`, decryptVoiceError);
              voiceTranscript = '';
            }
          }
        } else if (!journal.is_encrypted) {
          // For plaintext entries
          title = journal.title || '';
          content = journal.content || journal.title || '';
        } else {
          console.log(`[Batch] Skipping encrypted journal ${journal.journal_id} - no master key`);
          skipped++;
          continue;
        }

        const resolvedContent = resolveJournalContent({
          content,
          transcript: voiceTranscript,
        }).value;
        
        if (!resolvedContent || resolvedContent.length < 50) {
          console.log(`[Batch] Skipping journal ${journal.journal_id} - content too short`);
          skipped++;
          continue;
        }

        // Generate embedding
        console.log(`[Batch] Generating embedding for ${journal.journal_id}...`);
        const embedding = await generateEmbedding(resolvedContent);

        // Extract keyword and category in parallel
        console.log(`[Batch] Extracting keyword and category for ${journal.journal_id}...`);
        const [keyword, category] = await Promise.all([
          extractKeyword(resolvedContent, existingKeywords),
          extractCategory(resolvedContent, title)
        ]);
        existingKeywords.push(keyword); // Track for uniqueness
        console.log(`[Batch] Keyword: "${keyword}", Category: "${category}"`);
        
        // Store journal content for connection reason generation
        journalContentMap.set(journal.id, { title: title || keyword, content: resolvedContent });

        let insertRow: any = {
          entry_id: journal.id,
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

        // Store the embedding with keyword and category
        const { error: insertError } = await adminClient
          .from('journal_embeddings')
          .upsert(insertRow, {
            onConflict: 'entry_id'
          });

        if (insertError) {
          console.error(`Error storing embedding for ${journal.journal_id}:`, insertError);
          continue;
        }

        // Fetch all other embeddings for similarity comparison
        const { data: existingEmbeddings, error: embeddingsError } = await adminClient
          .from('journal_embeddings')
          .select('entry_id, embedding')
          .eq('user_id', user.id)
          .neq('entry_id', journal.id);

        if (embeddingsError) {
          console.error('Error fetching embeddings:', embeddingsError);
          continue;
        }

        console.log(`[Batch] Comparing with ${existingEmbeddings?.length || 0} existing embeddings`);

        // Calculate similarities and create edges with connection reasons
        const edges = [];
        const similarities: number[] = [];
        const sourceContent = journalContentMap.get(journal.id);
        
        for (const existing of existingEmbeddings || []) {
          // Parse embedding if it's a string (PostgreSQL vector type returns as string)
          let existingEmb = existing.embedding;
          if (typeof existingEmb === 'string') {
            // Remove brackets and parse as array of numbers
            existingEmb = JSON.parse(existingEmb.replace(/^\[/, '[').replace(/\]$/, ']'));
          }
          
          if (!Array.isArray(existingEmb)) {
            console.error(`[Batch] ERROR: Could not parse embedding! Type: ${typeof existingEmb}`);
            continue;
          }
          
          const similarity = cosineSimilarity(embedding, existingEmb);
          similarities.push(similarity);
          
          console.log(`[Batch] Similarity with ${existing.entry_id}: ${similarity.toFixed(4)}`);
          
          if (similarity >= threshold) {
            // Get target content for connection reason
            const targetContent = journalContentMap.get(existing.entry_id);
            
            // Generate connection reason
            const connectionReason = await generateConnectionReason(
              sourceContent?.title || 'Entry',
              sourceContent?.content || '',
              targetContent?.title || 'Entry',
              targetContent?.content || ''
            );
            console.log(`[Batch] Connection reason: "${connectionReason}"`);
            
            edges.push({
              source_entry_id: journal.id,
              target_entry_id: existing.entry_id,
              similarity: similarity,
              connection_reason: connectionReason,
              user_id: user.id,
              created_at: new Date().toISOString()
            });
          }
        }

        // Store edges
        if (edges.length > 0) {
          const { error: edgeError } = await adminClient
            .from('journal_edges')
            .upsert(edges, {
              onConflict: 'source_entry_id,target_entry_id'
            });

          if (edgeError) {
            console.error('Error storing edges:', edgeError);
          } else {
            totalEdges += edges.length;
          }
        }

        processed++;
        const maxSim = similarities.length > 0 ? Math.max(...similarities) : 0;
        const avgSim = similarities.length > 0 ? similarities.reduce((a, b) => a + b, 0) / similarities.length : 0;
        console.log(`[Batch] Processed ${journal.journal_id} - ${edges.length} connections found (max sim: ${maxSim.toFixed(3)}, avg: ${avgSim.toFixed(3)})`);

      } catch (error) {
        console.error(`Error processing journal ${journal.journal_id}:`, error);
        skipped++;
      }
    }

    return NextResponse.json({
      message: 'Batch processing complete',
      processed,
      skipped,
      total: journals.length,
      edgesCreated: totalEdges
    });

  } catch (error) {
    console.error('Batch embeddings error:', error);
    return NextResponse.json(
      { error: 'Failed to process batch embeddings' },
      { status: 500 }
    );
  }
}
