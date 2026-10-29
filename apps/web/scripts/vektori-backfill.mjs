#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { buildVektoriJournalMessages } from '../utils/vektori/payload.js';

const PAGE_SIZE = Number.parseInt(process.env.VEKTORI_BACKFILL_PAGE_SIZE || '100', 10);
const MAX_ITEMS = Number.parseInt(process.env.VEKTORI_BACKFILL_MAX_ITEMS || '0', 10);
const CHECKPOINT_PATH = process.env.VEKTORI_BACKFILL_CHECKPOINT || path.join(process.cwd(), '.vektori-backfill-checkpoint.json');

const requiredEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VEKTORI_BASE_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[vektori-backfill] Missing required env: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function readCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_PATH)) {
    return {
      page: 0,
      processed: 0,
      ingested: 0,
      skippedEncryptedOrEmpty: 0,
      failed: 0,
      lastJournalId: null,
      updatedAt: null,
    };
  }

  try {
    const raw = fs.readFileSync(CHECKPOINT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      page: 0,
      processed: 0,
      ingested: 0,
      skippedEncryptedOrEmpty: 0,
      failed: 0,
      lastJournalId: null,
      updatedAt: null,
    };
  }
}

function writeCheckpoint(state) {
  const payload = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

function buildMessage(journal) {
  return buildVektoriJournalMessages({
    journalId: journal.journal_id || journal.id,
    title: journal.title || '',
    content: journal.content || '',
    mood: journal.mood || '',
    entryDate: journal.journal_date || journal.created_at || '',
    createdAt: journal.created_at || '',
    updatedAt: journal.updated_at || '',
    eventType: 'backfill',
  });
}

async function ingestToVektori({ userId, sessionId, messages }) {
  const endpoint = `${process.env.VEKTORI_BASE_URL}${process.env.VEKTORI_ADD_PATH || '/add'}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.VEKTORI_API_KEY ? { Authorization: `Bearer ${process.env.VEKTORI_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      user_id: userId,
      session_id: sessionId,
      messages,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Vektori ingest failed: ${response.status} ${text}`);
  }
}

async function run() {
  const state = readCheckpoint();

  console.log('[vektori-backfill] Starting with state:', state);

  let keepGoing = true;
  while (keepGoing) {
    const from = state.page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('journals')
      .select('id, journal_id, user_id, title, content, mood, created_at, is_deleted')
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .range(from, to);

    if (error) {
      console.error('[vektori-backfill] Failed to fetch journals:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('[vektori-backfill] No more journals to process.');
      break;
    }

    for (const journal of data) {
      if (MAX_ITEMS > 0 && state.processed >= MAX_ITEMS) {
        keepGoing = false;
        break;
      }

      state.processed += 1;
      state.lastJournalId = journal.journal_id || journal.id;

      const messages = buildMessage(journal);
      if (!messages) {
        state.skippedEncryptedOrEmpty += 1;
        continue;
      }

      try {
        await ingestToVektori({
          userId: journal.user_id,
          sessionId: `journal-${journal.journal_id || journal.id}`,
          messages,
        });
        state.ingested += 1;
      } catch (err) {
        state.failed += 1;
        console.error(`[vektori-backfill] Failed journal ${journal.journal_id || journal.id}:`, err instanceof Error ? err.message : err);
      }
    }

    state.page += 1;
    writeCheckpoint(state);

    console.log(
      `[vektori-backfill] page=${state.page} processed=${state.processed} ingested=${state.ingested} skipped=${state.skippedEncryptedOrEmpty} failed=${state.failed}`
    );

    if (!keepGoing) break;
  }

  writeCheckpoint(state);
  console.log('[vektori-backfill] Complete. Final state:', state);
}

run().catch((err) => {
  console.error('[vektori-backfill] Fatal error:', err);
  process.exit(1);
});
