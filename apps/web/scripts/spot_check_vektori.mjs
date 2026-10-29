import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const CHECKPOINT_PATH = path.join(process.cwd(), '.vektori-backfill-checkpoint.json');
if (!fs.existsSync(CHECKPOINT_PATH)) {
  console.error('No checkpoint file found.');
  process.exit(1);
}
const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
if (!checkpoint.lastJournalId) {
  console.error('No lastJournalId in checkpoint.');
  process.exit(1);
}
const lastId = checkpoint.lastJournalId;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase envs.');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const { data, error } = await supabase
    .from('journals')
    .select('id, journal_id, user_id, title, content')
    .or(`journal_id.eq.${lastId},id.eq.${lastId}`)
    .limit(1);
  if (error) {
    console.error('Supabase query error:', error);
    process.exit(1);
  }
  if (!data || data.length === 0) {
    console.error('No matching journal found for lastJournalId:', lastId);
    process.exit(1);
  }
  const journal = data[0];
  console.log('Found journal:', { id: journal.id, journal_id: journal.journal_id, user_id: journal.user_id });

  const vektoriBase = process.env.VEKTORI_BASE_URL || 'http://127.0.0.1:8787';
  const q = encodeURIComponent((journal.content || journal.title || '').split('\n')[0].slice(0,80));
  const url = `${vektoriBase}/search?user_id=${journal.user_id}&q=${q}`;
  console.log('Querying shim:', url);
  try {
    const res = await fetch(url);
    const body = await res.json();
    console.log('Search result (truncated):', JSON.stringify(body, null, 2).slice(0,2000));
  } catch (err) {
    console.error('Search request failed:', err);
  }
})();
