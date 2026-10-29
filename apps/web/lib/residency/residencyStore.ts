// apps/web/lib/residency/residencyStore.ts
// Dual-persistence storage layer: Supabase tables with transparent fallback to user_context_model & service-role execution

import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { DHUN_COHORT_SEED_SNAPSHOTS } from './fixtures/cohortSeedData';
import { normalizeOnairosContext } from './onairosAdapter';
import { synthesizeIntentSnapshot } from './intentSynthesizer';
import type { ResidencyIntentSnapshot, ResidencyGraphData, ConnectionDetail } from './types';

// Helper to obtain an authenticated server client or admin client
async function getDbClient() {
  try {
    return createAdminClient();
  } catch {
    try {
      return await createClient();
    } catch {
      return null;
    }
  }
}

export async function getResidencySnapshot(
  userId: string,
  cohortId = 'dhun-oct-2026'
): Promise<ResidencyIntentSnapshot | null> {
  if (!userId) return null;
  const supabase = await getDbClient();
  if (!supabase) {
    if (userId === 'user_srinjoy' || userId === 'demo_user') {
      return DHUN_COHORT_SEED_SNAPSHOTS.find((s) => s.user_id === userId) || null;
    }
    return null;
  }

  // 1. Try dedicated table: residency_intent_snapshots
  try {
    const { data, error } = await supabase
      .from('residency_intent_snapshots')
      .select('*')
      .eq('user_id', userId)
      .eq('cohort_id', cohortId)
      .maybeSingle();

    if (!error && data) {
      return data as ResidencyIntentSnapshot;
    }
  } catch (e) {
    // Ignore schema cache errors
  }

  // 2. Fallback: check user_context_model
  try {
    const { data: contextData } = await supabase
      .from('user_context_model')
      .select('residency_snapshot')
      .eq('user_id', userId)
      .maybeSingle();

    if (contextData?.residency_snapshot) {
      return contextData.residency_snapshot as ResidencyIntentSnapshot;
    }
  } catch (e) {
    // Fallback continue
  }

  // 3. Fallback: check residency_participants by unique_id or email
  try {
    const { data: participant } = await supabase
      .from('residency_participants')
      .select('*')
      .or(`unique_id.eq.${userId},id.eq.${userId}`)
      .maybeSingle();

    if (participant && Array.isArray(participant.answers) && participant.answers.length > 0) {
      // Build a live draft snapshot on the fly from the participant's real answers
      const normalizedAnswers = {
        q1_intent: participant.answers[0] || '',
        q2_problem: participant.answers[1] || '',
        q3_blocker: participant.answers[2] || '',
      };
      const rawAnswers = {
        q1: { text: participant.answers[0] || '', audio_duration: participant.audio_clips?.[0]?.duration || '0:00' },
        q2: { text: participant.answers[1] || '', audio_duration: participant.audio_clips?.[1]?.duration || '0:00' },
        q3: { text: participant.answers[2] || '', audio_duration: participant.audio_clips?.[2]?.duration || '0:00' },
      };
      const draft = await synthesizeIntentSnapshot({
        userId: participant.unique_id || userId,
        userName: participant.name || 'Resident',
        cohortId,
        answers: normalizedAnswers,
        rawAnswers,
        socialLinks: participant.links || {},
        onairosContext: normalizeOnairosContext(participant.onairos_data),
      });
      return {
        ...draft,
        id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  } catch (e) {
    // Continue
  }

  // 4. Test mode / Demo fallback ONLY for explicit demo identifier
  if (userId === 'user_srinjoy' || userId === 'demo_user') {
    const seedMatch = DHUN_COHORT_SEED_SNAPSHOTS.find((s) => s.user_id === userId);
    if (seedMatch) return seedMatch;
  }

  // Real users return null so the UI can honestly display "Force doesn't know this yet"
  return null;
}

export async function saveResidencySnapshot(
  snapshot: Omit<ResidencyIntentSnapshot, 'id' | 'created_at' | 'updated_at'>,
  snapshotId?: string
): Promise<ResidencyIntentSnapshot> {
  const supabase = await getDbClient();
  const now = new Date().toISOString();
  const id = snapshotId || `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const fullSnapshot: ResidencyIntentSnapshot = {
    ...snapshot,
    id,
    created_at: now,
    updated_at: now,
    approved_at: snapshot.status === 'user_approved' ? now : undefined,
  };

  if (!supabase) {
    return fullSnapshot;
  }

  // 1. Attempt to upsert into dedicated table
  try {
    await supabase
      .from('residency_intent_snapshots')
      .upsert(
        {
          id,
          user_id: snapshot.user_id,
          user_name: snapshot.user_name,
          avatar_url: snapshot.avatar_url,
          cohort_id: snapshot.cohort_id || 'dhun-oct-2026',
          intent: snapshot.intent || '',
          problem: snapshot.problem || '',
          approach: snapshot.approach || [],
          current_frontier: snapshot.current_frontier || '',
          contribution: snapshot.contribution || { can_offer: [], seeking: [] },
          archetype: snapshot.archetype || null,
          positive_traits: snapshot.positive_traits || null,
          user_summary: snapshot.user_summary || null,
          top_traits_explanation: snapshot.top_traits_explanation || null,
          nudges: snapshot.nudges || null,
          onairos_metadata: snapshot.onairos_metadata || null,
          next_step: snapshot.next_step || {},
          provenance: snapshot.provenance || {},
          social_links: snapshot.social_links || {},
          raw_answers: snapshot.raw_answers || {},
          word_allocation: snapshot.word_allocation || {},
          normalized_onairos_context: snapshot.normalized_onairos_context || (snapshot as any).onairosContext || {},
          status: snapshot.status,
          sharing_consent: snapshot.sharing_consent ?? false,
          user_feedback: snapshot.user_feedback,
          approved_at: fullSnapshot.approved_at,
          updated_at: now,
        },
        { onConflict: 'user_id,cohort_id' }
      );
  } catch (e: any) {
    console.warn('[ResidencyStore] Dedicated table save notice:', e?.message);
  }

  // 2. Always persist to user_context_model as guaranteed backup
  try {
    await supabase.from('user_context_model').upsert(
      {
        user_id: snapshot.user_id,
        residency_snapshot: fullSnapshot,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    );
  } catch (err: any) {
    console.warn('[ResidencyStore] user_context_model backup notice:', err?.message);
  }

  return fullSnapshot;
}

export async function getCohortGraph(
  cohortId = 'dhun-oct-2026',
  currentUserId?: string
): Promise<ResidencyGraphData> {
  const supabase = await getDbClient();
  const snapshots: ResidencyIntentSnapshot[] = [...DHUN_COHORT_SEED_SNAPSHOTS];

  // 1. Query live approved & shared snapshots strictly within the specified cohort
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('residency_intent_snapshots')
        .select('*')
        .eq('cohort_id', cohortId)
        .eq('status', 'user_approved')
        .eq('sharing_consent', true);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        const existingIdx = snapshots.findIndex((s) => s.user_id === row.user_id);
        if (existingIdx >= 0) {
          snapshots[existingIdx] = row as ResidencyIntentSnapshot;
        } else {
          snapshots.push(row as ResidencyIntentSnapshot);
        }
      }
    }
  } catch (e) {
    // Continue
  }
  }

  // 2. If current user has a saved approved snapshot in user_context_model, merge it
  if (currentUserId) {
    const userSnap = await getResidencySnapshot(currentUserId, cohortId);
    if (userSnap && userSnap.status === 'user_approved' && userSnap.sharing_consent) {
      const idx = snapshots.findIndex((s) => s.user_id === currentUserId);
      if (idx >= 0) {
        snapshots[idx] = userSnap;
      } else {
        snapshots.push(userSnap);
      }
    }
  }

  // Build 3-node graph and 2 edge families
  const { buildResidencyGraph } = await import('./graphBuilder');
  return buildResidencyGraph(snapshots, cohortId);
}

export async function getCohortConnectionDetail(
  userIdA: string,
  userIdB: string,
  cohortId = 'dhun-oct-2026'
): Promise<ConnectionDetail | null> {
  const snapshots: ResidencyIntentSnapshot[] = [...DHUN_COHORT_SEED_SNAPSHOTS];

  const snapA = await getResidencySnapshot(userIdA, cohortId);
  const snapB = await getResidencySnapshot(userIdB, cohortId);

  if (snapA) {
    const idx = snapshots.findIndex((s) => s.user_id === userIdA);
    if (idx >= 0) snapshots[idx] = snapA;
    else snapshots.push(snapA);
  }

  if (snapB) {
    const idx = snapshots.findIndex((s) => s.user_id === userIdB);
    if (idx >= 0) snapshots[idx] = snapB;
    else snapshots.push(snapB);
  }

  const { getConnectionDetail } = await import('./graphBuilder');
  return getConnectionDetail(userIdA, userIdB, snapshots);
}

/**
 * Incrementally refresh a user's intent snapshot from their latest onboarding answers,
 * Onairos profile, and recent journals, then update their node & edges in the cohort graph.
 */
export async function refreshUserSnapshotFromLatestData(
  userId: string,
  cohortId = 'dhun-oct-2026'
): Promise<ResidencyIntentSnapshot | null> {
  const supabase = await getDbClient();
  if (!supabase) return null;

  // 1. Fetch user context & existing snapshot
  let context: any = null;
  try {
    const { data } = await supabase
      .from('user_context_model')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    context = data;
  } catch (e) {}

  // 2. Fetch latest journal entries
  let recentJournals: any[] = [];
  try {
    const { data } = await supabase
      .from('journals')
      .select('title, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);
    recentJournals = data || [];
  } catch (e) {}

  const existing = await getResidencySnapshot(userId, cohortId);
  const answers = { ...(context?.onboarding_answers || {}) };

  // Augment answers with recent journal reflections if available
  if (Array.isArray(recentJournals) && recentJournals.length > 0) {
    const journalSummary = recentJournals
      .map((j) => `${j.title || 'Entry'}: ${(j.content || '').slice(0, 150)}`)
      .join(' | ');
    answers['recent_journal_reflections'] = { raw_answer: journalSummary };
  }

  const normalizedOnairos = normalizeOnairosContext(context?.onairos_payload);

  const draft = await synthesizeIntentSnapshot({
    userId,
    cohortId,
    userName: context?.user_name || existing?.user_name || 'Resident',
    answers,
    contributions: existing?.contribution || {
      can_offer: ['Systems design', 'Problem solving'],
      seeking: ['Peer feedback', 'Exploration partners'],
    },
    onairosContext: normalizedOnairos,
  });

  // Preserve user approval and sharing consent
  const toSave = {
    ...draft,
    status: existing?.status || 'user_approved',
    sharing_consent: existing?.sharing_consent ?? false,
  };

  return await saveResidencySnapshot(toSave, existing?.id);
}

/**
 * Persists raw Onairos payload and normalized traits directly to Supabase
 * across user_context_model, residency_participants, and residency_intent_snapshots.
 */
export async function saveOnairosData(
  userId: string,
  rawPayload: any,
  normalized?: any,
  name = 'Resident'
): Promise<boolean> {
  const supabase = await getDbClient();
  if (!supabase) {
    console.warn('⚠️ [DB Persistence] Database client unavailable for saveOnairosData');
    return false;
  }
  const now = new Date().toISOString();
  console.log(`💾 [DB Persistence] Saving raw Onairos payload for user: ${userId} (${name})`);

  let savedAny = false;

  // 1. Persist to user_context_model (onairos_payload & onairos_connected_at)
  try {
    const { error } = await supabase.from('user_context_model').upsert(
      {
        user_id: userId,
        onairos_payload: rawPayload,
        onairos_connected_at: now,
        updated_at: now,
      },
      { onConflict: 'user_id' }
    );
    if (!error) {
      console.log(`✅ [DB Persistence] user_context_model updated with raw Onairos payload`);
      savedAny = true;
    } else {
      console.warn(`⚠️ [DB Persistence] user_context_model notice:`, error.message);
    }
  } catch (e: any) {
    console.warn(`⚠️ [DB Persistence] user_context_model error:`, e?.message);
  }

  // 2. Persist to residency_participants (onairos_data & onairos_status)
  try {
    const { error } = await supabase.from('residency_participants').upsert(
      {
        unique_id: userId,
        name,
        onairos_data: rawPayload,
        onairos_status: 'connected',
        updated_at: now,
      },
      { onConflict: 'unique_id' }
    );
    if (!error) {
      console.log(`✅ [DB Persistence] residency_participants updated with onairos_data`);
      savedAny = true;
    } else {
      console.warn(`⚠️ [DB Persistence] residency_participants notice:`, error.message);
    }
  } catch (e: any) {
    console.warn(`⚠️ [DB Persistence] residency_participants error:`, e?.message);
  }

  // 3. Persist to residency_intent_snapshots if row exists
  try {
    const updateData: any = {
      normalized_onairos_context: normalized || {},
      updated_at: now,
    };
    const { error } = await supabase
      .from('residency_intent_snapshots')
      .update(updateData)
      .eq('user_id', userId);
    if (!error) {
      console.log(`✅ [DB Persistence] residency_intent_snapshots updated with normalized onairos`);
      savedAny = true;
    }
  } catch (e: any) {
    // Ignore if row doesn't exist yet
  }

  return savedAny;
}


/**
 * Persists companion conversation turns, user messages, agent responses,
 * breakthroughs/notes, and memory frontier updates to Supabase tables
 * (residency_entries, residency_intent_snapshots, residency_participants).
 */
export async function saveCompanionTurn(params: {
  residentId: string;
  name?: string;
  userMessage: string;
  kind?: string;
  replyText: string;
  options?: any[] | null;
  note?: string | null;
  memoryUpdate?: {
    current_frontier?: string | null;
    next_step?: string | null;
  } | null;
}): Promise<boolean> {
  const supabase = await getDbClient();
  if (!supabase) {
    console.warn('⚠️ [DB Persistence] Database client unavailable for saveCompanionTurn');
    return false;
  }

  const now = new Date().toISOString();
  const dateStr = now.split('T')[0];
  const timeStr = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
  const { residentId, name = 'Resident', userMessage, kind = 'text', replyText, options, note, memoryUpdate } = params;

  console.log(`💾 [DB Persistence] Persisting companion turn for resident: ${residentId} (${name})`);

  let success = false;

  // 1. Ensure participant row exists in residency_participants
  try {
    await supabase.from('residency_participants').upsert(
      {
        unique_id: residentId,
        name,
        updated_at: now,
      },
      { onConflict: 'unique_id' }
    );
  } catch (e: any) {
    // Non-blocking
  }

  // 2. Save user message into residency_entries
  if (userMessage) {
    try {
      const userEntryId = `chat_u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await supabase.from('residency_entries').upsert(
        {
          unique_id: residentId,
          entry_id: userEntryId,
          title: kind === 'audio' ? 'Audio Note' : 'Resident Chat',
          content: userMessage,
          blocks: [{ id: `b_${Date.now()}`, kind, html: `<p>${userMessage}</p>` }],
          themes: ['Companion', 'Conversation'],
          mood: 0,
          entry_date: dateStr,
          entry_time: timeStr,
          metadata: {
            source: 'companion_chat',
            sender: 'user',
            kind,
            created_at: now,
          },
          updated_at: now,
        },
        { onConflict: 'unique_id,entry_id' }
      );
      success = true;
    } catch (e: any) {
      console.warn('⚠️ [DB Persistence] Error saving user companion message:', e?.message);
    }
  }

  // 3. Save Force reply into residency_entries
  if (replyText) {
    try {
      const agentEntryId = `chat_f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await supabase.from('residency_entries').upsert(
        {
          unique_id: residentId,
          entry_id: agentEntryId,
          title: 'Force Agent Reply',
          content: replyText,
          blocks: [{ id: `b_${Date.now()}`, kind: 'text', html: `<p>${replyText}</p>` }],
          themes: ['Companion', 'Force'],
          mood: 0,
          entry_date: dateStr,
          entry_time: timeStr,
          metadata: {
            source: 'companion_chat',
            sender: 'force',
            options: options || [],
            note: note || null,
            memory_update: memoryUpdate || null,
            created_at: now,
          },
          updated_at: now,
        },
        { onConflict: 'unique_id,entry_id' }
      );
      success = true;
    } catch (e: any) {
      console.warn('⚠️ [DB Persistence] Error saving agent companion message:', e?.message);
    }
  }

  // 4. If a breakthrough note was extracted, save as a distinct reflection in residency_entries
  if (note) {
    try {
      const noteEntryId = `note_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await supabase.from('residency_entries').upsert(
        {
          unique_id: residentId,
          entry_id: noteEntryId,
          title: 'Breakthrough Note',
          content: note,
          blocks: [{ id: `b_${Date.now()}`, kind: 'text', html: `<p>${note}</p>` }],
          themes: ['Insight', 'Breakthrough'],
          mood: 1,
          entry_date: dateStr,
          entry_time: timeStr,
          metadata: {
            source: 'companion_insight',
            triggered_by: userMessage,
            created_at: now,
          },
          updated_at: now,
        },
        { onConflict: 'unique_id,entry_id' }
      );
      console.log(`💡 [DB Persistence] Breakthrough note persisted for ${residentId}: "${note}"`);
    } catch (e: any) {
      console.warn('⚠️ [DB Persistence] Error saving note entry:', e?.message);
    }
  }

  // 5. If memory update modified the resident's current_frontier or next_step, update residency_intent_snapshots
  if (memoryUpdate?.current_frontier || memoryUpdate?.next_step) {
    try {
      const updates: any = { updated_at: now };
      if (memoryUpdate.current_frontier) {
        updates.current_frontier = memoryUpdate.current_frontier;
      }
      if (memoryUpdate.next_step) {
        updates.next_step = {
          text: memoryUpdate.next_step,
          why_it_may_help: 'Derived from recent companion exploration.',
          status: 'suggested',
        };
      }
      const { error } = await supabase
        .from('residency_intent_snapshots')
        .update(updates)
        .eq('user_id', residentId);
      if (!error) {
        console.log(`🔄 [DB Persistence] residency_intent_snapshots frontier updated for ${residentId}`);
      }
    } catch (e: any) {
      console.warn('⚠️ [DB Persistence] Error updating snapshot memory:', e?.message);
    }
  }

  return success;
}

