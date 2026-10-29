import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DHUN_SCHEDULE,
  VERIFIED_DHUN_CAB_CONTACTS,
  checkResidencyConflicts,
  getCoordinationState,
  updateCoordinationState,
  evaluateCoordinationPlan,
  resetCoordinationState,
} from '../lib/force-agent/dhunCoordination.ts';
import { extractMediaFromText } from '../lib/photon/outboundClient.ts';
import { FORCE_APP_TOOLS } from '../lib/force-agent/appTools.ts';
import { buildSocialAgentPrompt } from '../lib/force-agent/promptBuilder.ts';
import { forceAgentOrchestrator } from '../lib/force-agent/orchestrator.ts';
import { processPhotonPayload } from '../lib/photon/webhook.ts';

// ── Test 1: Dhun Residency Schedule & Conflict Detection ───────────────────────
test('Dhun Residency Schedule has Oct 24-30 events with accurate time windows', () => {
  assert.ok(DHUN_SCHEDULE['2026-10-24'], 'Saturday schedule exists');
  assert.ok(DHUN_SCHEDULE['2026-10-25'], 'Sunday schedule exists');

  // Sunday Oct 25 has Stand-up at 11:00, Logos Node workshop with Marina at 12:00, Dinner at 19:30
  const sunday = DHUN_SCHEDULE['2026-10-25'];
  const standup = sunday.find((e) => e.event.includes('Daily Stand-up'));
  const workshop = sunday.find((e) => e.event.includes('Logos Node'));
  const dinner = sunday.find((e) => e.event.includes('Dinner'));

  assert.ok(standup, 'Daily Standup present on Sunday');
  assert.ok(workshop, 'Marina workshop present on Sunday');
  assert.ok(dinner, 'Dinner present on Sunday');
});

test('checkResidencyConflicts identifies potential evening conflict with dinner and accounts for 45-60 min travel time', () => {
  // Leaving at 18:00 (6:00 PM) for concert, returning at 23:30 (11:30 PM)
  const result = checkResidencyConflicts('2026-10-25', '18:00', '23:30');

  assert.equal(result.hasConflict, true);
  const conflictNames = result.conflictingEvents.map((e) => e.event);
  assert.ok(conflictNames.includes('Dinner'), 'Dinner (19:30-21:00) overlaps with the evening outing');
  assert.ok(
    result.transitTimeNotes.includes('45–60 minutes') || result.transitTimeNotes.includes('40–50 km'),
    'Transit time to central Jaipur is highlighted'
  );
});

// ── Test 2: Structured Coordination State & Scenario Testing ──────────────────
test('Scenario A — Feasible group: approvals granted, transport sufficient, return confirmed -> ready_for_confirmation', () => {
  const sessionId = 'test_scenario_a';
  resetCoordinationState(sessionId);

  // 1. Initial State: Unknowns exist
  const initial = getCoordinationState(sessionId);
  assert.equal(initial.status, 'feasibility_pending');
  assert.ok(
    initial.unknowns.some((u) => u.toLowerCase().includes('host') && u.toLowerCase().includes('permission')),
    'Host permission is initially an unknown'
  );

  // 2. Resolve all constraints
  const updated = updateCoordinationState(sessionId, {
    eventVerified: true,
    eventName: 'Jaipur Classical Fusion Concert',
    eventTime: '20:00',
    eventVenue: 'Jawahar Kala Kendra, Jaipur',
    hostPermission: 'granted',
    hostNotes: 'Manvendra approved early sign-out after 17:00',
    interestedCount: 3,
    interestedPeople: ['Srinjoy', 'Shriyanshi', 'Aarav'],
    transportCapacity: 4, // 1 cab = 4 seats
    returnPlan: 'confirmed',
    returnNotes: 'Driver Ramesh pre-booked for 23:30 return trip to Dhun',
  });

  assert.equal(updated.status, 'ready_for_confirmation');
  assert.equal(updated.blockers.length, 0);
  assert.ok(updated.nextConcreteAction.toLowerCase().includes('ready to confirm'));
  assert.ok(updated.confirmedFacts.some((f) => f.includes('Host approval confirmed')));
  assert.ok(updated.confirmedFacts.some((f) => f.includes('Return logistics confirmed')));
});

test('Scenario B — Capacity mismatch: more people interested than vehicle capacity -> flags mismatch and next action', () => {
  const sessionId = 'test_scenario_b';
  resetCoordinationState(sessionId);

  // 6 residents want to go, but single cab capacity is 4
  const mismatchState = updateCoordinationState(sessionId, {
    eventVerified: true,
    hostPermission: 'granted',
    interestedCount: 6,
    interestedPeople: ['Srinjoy', 'Shriyanshi', 'Aarav', 'Elena', 'Vikram', 'Pooja'],
    transportCapacity: 4, // Cab capacity is only 4!
    returnPlan: 'confirmed',
  });

  assert.equal(mismatchState.status, 'capacity_mismatch');
  assert.ok(
    mismatchState.nextConcreteAction.toLowerCase().includes('capacity mismatch') ||
      mismatchState.nextConcreteAction.toLowerCase().includes('second cab') ||
      mismatchState.nextConcreteAction.toLowerCase().includes('overflow'),
    'Next concrete action explains the capacity mismatch'
  );
});

test('Scenario C — Unresolved constraint: host permission or return plan unknown -> flags blocker, does not falsely confirm', () => {
  const sessionId = 'test_scenario_c';
  resetCoordinationState(sessionId);

  // Event is known and 4 people interested, BUT host permission is unconfirmed and return plan is unknown
  const blockedState = updateCoordinationState(sessionId, {
    eventVerified: true,
    hostPermission: 'unknown',
    interestedCount: 4,
    transportCapacity: 4,
    returnPlan: 'unknown',
  });

  assert.notEqual(blockedState.status, 'ready_for_confirmation');
  assert.ok(blockedState.blockers.length > 0, 'Blockers list is populated');
  assert.ok(
    blockedState.blockers.some((b) => b.toLowerCase().includes('host') || b.toLowerCase().includes('return')),
    'Unresolved blockers are explicitly identified'
  );
  assert.ok(
    blockedState.nextConcreteAction.toLowerCase().includes('host') ||
      blockedState.nextConcreteAction.toLowerCase().includes('driver') ||
      blockedState.nextConcreteAction.toLowerCase().includes('unresolved'),
    'Next action addresses the unresolved blocker'
  );
});

// ── Test 3: Tool Definitions & Prompt System Integration ───────────────────────
test('FORCE_APP_TOOLS includes sidequest coordination and residency schedule tools', () => {
  const toolNames = FORCE_APP_TOOLS.map((t) => t.name);
  assert.ok(toolNames.includes('check_residency_schedule'));
  assert.ok(toolNames.includes('manage_sidequest_coordination'));
  assert.ok(toolNames.includes('draft_group_interest_check'));
});

test('buildSocialAgentPrompt incorporates AI-Coordinated Fun guidelines', () => {
  const prompt = buildSocialAgentPrompt({
    platform: 'telegram',
    senderName: 'Srinjoy',
    location: { city: 'Jaipur', region: 'Rajasthan', country: 'India' },
  });

  assert.ok(prompt.includes('AI-COORDINATED FUN'));
  assert.ok(prompt.includes('Dhun'));
  assert.ok(prompt.includes('check_residency_schedule'));
  assert.ok(prompt.includes('manage_sidequest_coordination'));
  assert.ok(prompt.includes('+91 98291 44820'), 'Prompts provide Ramesh driver real contact');
  assert.ok(prompt.includes('+91 99830 10250'), 'Prompts provide Rajputana Cabs real contact');
});

test('Verified Cab Contacts catalog contains valid Jaipur phone numbers and capacity details', () => {
  assert.ok(VERIFIED_DHUN_CAB_CONTACTS.length >= 3);
  const ramesh = VERIFIED_DHUN_CAB_CONTACTS.find((c) => c.driverName === 'Ramesh Ji');
  assert.ok(ramesh, 'Ramesh local driver exists');
  assert.equal(ramesh.phone, '+91 98291 44820');
  assert.equal(ramesh.capacity, 7);

  const rajputana = VERIFIED_DHUN_CAB_CONTACTS.find((c) => c.operatorName.includes('Rajputana'));
  assert.ok(rajputana, 'Rajputana Cabs exists');
  assert.equal(rajputana.phone, '+91 99830 10250');
  assert.ok(rajputana.capacity >= 7);
});

test('Visual Imagery: extractMediaFromText captures concert photo for rich media dispatch', () => {
  const replyWithPhoto =
    '![Live Sufi Concert](https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80)\n\n' +
    'The 8 PM Sufi Fusion show at Jawahar Kala Kendra is locked in! Innova departs at 5:15 PM sharp.';

  const { mediaUrl, cleanedText } = extractMediaFromText(replyWithPhoto);
  assert.ok(mediaUrl, 'Media URL is extracted');
  assert.ok(mediaUrl.includes('photo-1514525253161-7a46d19cd819'));
  assert.ok(cleanedText.includes('The 8 PM Sufi Fusion show'));
  assert.ok(!cleanedText.includes('!['), 'Markdown image tag is stripped from text bubble');
});

// ── Test 4: Orchestrator Tool Execution ─────────────────────────────────────────
test('Orchestrator executes check_residency_schedule tool accurately', async () => {
  const result = await forceAgentOrchestrator.handle({
    userId: 'test_dhun_user_1',
    type: 'social_interaction',
    tool: 'photon',
    query: 'Check if there are any conflicts in the Dhun schedule tomorrow Sunday for an evening concert',
    socialContext: {
      platform: 'telegram',
      senderId: 'test_dhun_sender_1',
      senderName: 'Srinjoy',
    },
  });

  assert.ok(result);
  assert.ok(result.sideEffects?.sidequestCoordination, 'Flags sidequestCoordination side effect');
});

// ── Test 5: Full Photon Webhook Flow for Jaipur Concert Intention ──────────────
test('Photon Webhook processes Jaipur concert coordination intention and triggers AI coordination', async () => {
  const payload = {
    id: `evt_coord_${Date.now()}`,
    type: 'message.received',
    source: 'telegram.photon',
    data: {
      object: {
        id: `msg_coord_${Date.now()}`,
        platform: 'telegram',
        content: {
          type: 'text',
          text: 'Two of us want to go to a concert in Jaipur tomorrow. Help us make it happen.',
        },
        sentBy: {
          id: 'usr_dhun_resident_1',
          handle: 'test_resident_handle',
          metadata: { displayName: 'Srinjoy' },
        },
        space: { id: 'spc_dhun_space_1' },
      },
    },
  };

  const mockAdminClient = {
    from: (table) => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            limit: () => Promise.resolve({ data: [{ user_id: 'usr_dhun_resident_1' }], error: null }),
          }),
          maybeSingle: () => Promise.resolve({ data: { id: 'usr_dhun_resident_1', name: 'Srinjoy', location: 'Dhun, Jaipur' }, error: null }),
          order: () => ({ limit: () => Promise.resolve({ data: [] }) }),
        }),
        in: () => ({
          limit: () => Promise.resolve({ data: [{ user_id: 'usr_dhun_resident_1' }], error: null }),
        }),
        or: () => ({
          limit: () => Promise.resolve({ data: [{ id: 'usr_dhun_resident_1', name: 'Srinjoy', location: 'Dhun, Jaipur' }], error: null }),
        }),
        order: () => ({ limit: () => Promise.resolve({ data: [] }) }),
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    }),
  };

  const processResult = await processPhotonPayload(payload, mockAdminClient);
  assert.equal(processResult.ok, true);
  assert.equal(processResult.handled, true);
  assert.ok(processResult.replyText, 'Reply text is generated');
  assert.ok(processResult.replyText.length > 20);

  // The reply should acknowledge the mission, timing/schedule, and start the coordination loop
  assert.ok(processResult.sideEffects?.sidequestCoordination, 'Sidequest coordination is marked in side effects');
});

// ── Test 6: Calendar & Gmail Tools (User Schedule & Email Access) ──────────────
import { getUserSchedule, getUserGmail } from '../lib/force-agent/calendarGmailTools.ts';

test('getUserSchedule retrieves residency schedule for today (Oct 24) and handles unlinked Google Calendar gracefully', async () => {
  const mockAdminClient = {
    from: (table) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }), // No Google Calendar connected yet
          }),
        }),
      }),
    }),
  };

  const schedule = await getUserSchedule({
    userId: 'usr_test_123',
    dateStr: '2026-10-24',
    adminClient: mockAdminClient,
  });

  assert.equal(schedule.date, '2026-10-24');
  assert.equal(schedule.residencySchedule.hasSchedule, true);
  assert.ok(schedule.residencySchedule.events.length > 0, 'Dhun residency events present');
  assert.equal(schedule.googleCalendar.connected, false);
  assert.ok(schedule.connectUrl, 'Connect URL is provided when Google Calendar is unlinked');
  assert.ok(
    schedule.summary.includes('Dhun Residency Schedule'),
    'Summary contains Dhun Residency Schedule'
  );
  assert.ok(
    schedule.summary.includes('https://www.findmyforce.com/settings/integrations'),
    'Summary includes integration link for Google Calendar'
  );
});

test('getUserSchedule merges Google Calendar events when user has connected their Google account', async () => {
  const mockAdminClient = {
    from: (table) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  id: 'gcal_conn_1',
                  user_id: 'usr_test_123',
                  google_email: 'srinjoy@findmyforce.com',
                  access_token: 'mock_token',
                  expires_at: Date.now() + 3600000,
                  is_active: true,
                },
                error: null,
              }),
          }),
        }),
      }),
    }),
  };

  // Mock global fetch for Google Calendar API
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('googleapis.com/calendar')) {
      return {
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'ev1',
              summary: 'Sync with Investor / Partner',
              start: { dateTime: '2026-10-24T14:00:00Z' },
              end: { dateTime: '2026-10-24T14:30:00Z' },
              location: 'Google Meet',
            },
          ],
        }),
      };
    }
    return originalFetch(url, opts);
  };

  try {
    const schedule = await getUserSchedule({
      userId: 'usr_test_123',
      dateStr: '2026-10-24',
      adminClient: mockAdminClient,
    });

    assert.equal(schedule.googleCalendar.connected, true);
    assert.equal(schedule.googleCalendar.email, 'srinjoy@findmyforce.com');
    assert.equal(schedule.googleCalendar.events.length, 1);
    assert.equal(schedule.googleCalendar.events[0].title, 'Sync with Investor / Partner');
    assert.ok(schedule.summary.includes('Sync with Investor / Partner'));
  } finally {
    global.fetch = originalFetch;
  }
});

test('getUserGmail returns connect URL when Gmail is not linked and summarizes emails when connected', async () => {
  // 1. Unlinked state
  const mockAdminUnlinked = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }),
  };

  const unlinkedRes = await getUserGmail({
    userId: 'usr_unlinked_1',
    adminClient: mockAdminUnlinked,
  });

  assert.equal(unlinkedRes.connected, false);
  assert.ok(unlinkedRes.connectUrl?.includes('settings/integrations'));
  assert.ok(unlinkedRes.summary.includes('https://www.findmyforce.com/settings/integrations'));

  // 2. Connected state
  const mockAdminConnected = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  id: 'gmail_conn_1',
                  user_id: 'usr_connected_1',
                  google_email: 'srinjoy@gmail.com',
                  access_token: 'mock_gmail_token',
                  expires_at: Date.now() + 3600000,
                  is_active: true,
                },
                error: null,
              }),
          }),
        }),
      }),
    }),
  };

  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('gmail.googleapis.com/gmail/v1/users/me/messages?')) {
      return {
        ok: true,
        json: async () => ({
          messages: [{ id: 'msg_101' }],
        }),
      };
    }
    if (typeof url === 'string' && url.includes('gmail.googleapis.com/gmail/v1/users/me/messages/msg_101')) {
      return {
        ok: true,
        json: async () => ({
          id: 'msg_101',
          snippet: 'Looking forward to seeing you in Jaipur for the residency dinner.',
          payload: {
            headers: [
              { name: 'From', value: 'Alex <alex@example.com>' },
              { name: 'Subject', value: 'Jaipur Residency Welcome' },
              { name: 'Date', value: 'Sat, 24 Oct 2026 10:00:00 GMT' },
            ],
          },
        }),
      };
    }
    return originalFetch(url, opts);
  };

  try {
    const gmailRes = await getUserGmail({
      userId: 'usr_connected_1',
      adminClient: mockAdminConnected,
    });

    assert.equal(gmailRes.connected, true);
    assert.equal(gmailRes.email, 'srinjoy@gmail.com');
    assert.equal(gmailRes.messages.length, 1);
    assert.equal(gmailRes.messages[0].subject, 'Jaipur Residency Welcome');
    assert.ok(gmailRes.summary.includes('Alex <alex@example.com>'));
    assert.ok(gmailRes.summary.includes('Jaipur Residency Welcome'));
  } finally {
    global.fetch = originalFetch;
  }
});
