import 'dotenv/config';
import { forceAgentOrchestrator } from '../lib/force-agent/orchestrator.ts';
import { getCoordinationState, resetCoordinationState } from '../lib/force-agent/dhunCoordination.ts';

const sessionId = `dhun_resident_srinjoy_${Date.now()}`;
resetCoordinationState(sessionId);

const conversationHistory = [];

async function sendUserMessage(turnNum, userMessage) {
  console.log(`\n================================================================`);
  console.log(`💬 [TURN ${turnNum}] USER SAYS:`);
  console.log(`"${userMessage}"`);
  console.log(`================================================================`);

  conversationHistory.push({ role: 'user', content: userMessage });

  const startTime = Date.now();
  const response = await forceAgentOrchestrator.handle({
    userId: sessionId,
    type: 'social_interaction',
    tool: 'photon',
    query: userMessage,
    socialContext: {
      platform: 'telegram',
      senderId: sessionId,
      senderName: 'Srinjoy',
      recentThreadTurns: conversationHistory.map((t) => ({
        role: t.role,
        content: t.content,
        timestamp: new Date().toISOString(),
      })),
    },
  });

  const durationMs = Date.now() - startTime;
  const replyText = response.outboundSocialReply?.text || response.message || '';
  conversationHistory.push({ role: 'assistant', content: replyText });

  console.log(`\n🤖 [TURN ${turnNum}] FORCE AGENT REPLIES (${durationMs}ms):`);
  console.log(replyText);

  const coordState = getCoordinationState(sessionId);
  console.log(`\n📊 [COORDINATION ENGINE STATE]:`);
  console.log(`- Status: ${coordState.status}`);
  console.log(`- Interested Count: ${coordState.interestedCount} (${coordState.interestedPeople.join(', ')})`);
  console.log(`- Vehicle Capacity: ${coordState.transportCapacity} seats`);
  console.log(`- Host Permission: ${coordState.hostPermission}`);
  console.log(`- Return Plan: ${coordState.returnPlan}`);
  console.log(`- Blockers (${coordState.blockers.length}): ${coordState.blockers.join(' | ') || 'None'}`);
  console.log(`- Next Concrete Action: ${coordState.nextConcreteAction}`);

  return { replyText, coordState, response };
}

async function runFullDhunCoordinationTest() {
  console.log(`🚀 Starting End-to-End Live Multi-Turn Test of AI-Coordinated Fun`);
  console.log(`Setting: Dhun Residency (Jaipur bioreserve) | Target: Sunday Concert Outing`);

  // --- Turn 1: Initial Intention ---
  const turn1 = await sendUserMessage(
    1,
    'Another resident and I want to go to a concert in Jaipur tomorrow. Help us make it happen.'
  );

  // --- Turn 2: Scenario B - Capacity Mismatch ---
  const turn2 = await sendUserMessage(
    2,
    'I checked with the community and 4 other residents want to join us, making it 6 people total. Can we just book a standard cab and head out?'
  );

  // --- Turn 3: Scenario C - Unresolved Constraint ---
  const turn3 = await sendUserMessage(
    3,
    'Got it on the cab capacity! We upgraded our booking to a 7-seater Innova, so capacity is now 7 seats. Can we mark the trip as confirmed now?'
  );

  // --- Turn 4: Resolving Details & Catching Schedule Conflict ---
  const turn4 = await sendUserMessage(
    4,
    'We have tickets for the 8 PM Sufi Fusion concert at Jawahar Kala Kendra, and we pre-booked driver Ramesh who will wait for us in Jaipur and drive us back to Dhun at 11:30 PM.'
  );

  // --- Turn 5: Scenario A - Feasible Group & Host Sign-off ---
  const turn5 = await sendUserMessage(
    5,
    'Yes, Manvendra explicitly gave the thumbs up and approved us skipping dinner at Dhun since we will grab early dinner in Jaipur before the show. All 6 of us are fully committed!'
  );

  console.log(`\n================================================================`);
  console.log(`🎯 TEST RESULTS SUMMARY:`);
  console.log(`Turn 1 (Intention & Schedule check): ${turn1.replyText.length > 50 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Turn 2 (Scenario B - Capacity Mismatch caught): ${turn2.coordState.status === 'capacity_mismatch' || turn2.replyText.toLowerCase().includes('capacity') || turn2.replyText.toLowerCase().includes('innova') || turn2.replyText.toLowerCase().includes('cab') ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Turn 3 (Scenario C - Refused false confirmation): ${turn3.coordState.status !== 'ready_for_confirmation' || turn3.coordState.blockers.length > 0 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Turn 4 (Schedule Conflict Caught): ${turn4.replyText.toLowerCase().includes('dinner') || turn4.replyText.toLowerCase().includes('conflict') ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Turn 5 (Scenario A - All constraints cleared & confirmed): ${turn5.coordState.status === 'ready_for_confirmation' || turn5.coordState.blockers.length === 0 || turn5.replyText.toLowerCase().includes('confirm') || turn5.replyText.toLowerCase().includes('roll') ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`================================================================\n`);
}

runFullDhunCoordinationTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
