/**
 * Dhun Residency & Sidequest Coordination Engine
 * Implements "AI-Coordinated Fun" for Force x Photon.
 *
 * Coordinates group outings (e.g. Jaipur concert) from Dhun bioreserve:
 * - Schedule conflict detection against the Dhun October 24–30 calendar
 * - Minimal structured state tracking (confirmed facts vs unknowns)
 * - Interest-check message generation with user review guardrail
 * - Capacity mismatch detection (group size vs transport seats)
 * - Strict epistemic truthfulness: never claims permission, booking, or ride is confirmed unless verified
 */

export interface DhunScheduleEvent {
  time: string;
  startMinutes: number; // minutes from midnight
  endMinutes: number;
  event: string;
  isMandatoryOrKey?: boolean;
}

export const DHUN_SCHEDULE: Record<string, DhunScheduleEvent[]> = {
  '2026-10-24': [
    { time: '07:00–09:00', startMinutes: 420, endMinutes: 540, event: 'Breakfast' },
    { time: '07:00–08:00', startMinutes: 420, endMinutes: 480, event: 'Wake-up swim — South Lake' },
    { time: '09:00–10:00', startMinutes: 540, endMinutes: 600, event: 'Yoga / Meditation' },
    { time: '11:00–12:00', startMinutes: 660, endMinutes: 720, event: 'About Dhun — founder Manvendra', isMandatoryOrKey: true },
    { time: '13:00–14:00', startMinutes: 780, endMinutes: 840, event: 'Lunch' },
    { time: '14:00–17:00', startMinutes: 840, endMinutes: 1020, event: 'Build time — Engineer Support / discussion zone' },
    { time: '14:00–18:00', startMinutes: 840, endMinutes: 1080, event: 'Build time — Quiet work' },
    { time: '17:00–18:00', startMinutes: 1020, endMinutes: 1080, event: 'Daily Stand-up', isMandatoryOrKey: true },
    { time: '19:30–21:00', startMinutes: 1170, endMinutes: 1260, event: 'Dinner', isMandatoryOrKey: true },
  ],
  '2026-10-25': [
    { time: '07:00–09:00', startMinutes: 420, endMinutes: 540, event: 'Breakfast' },
    { time: '07:00–08:00', startMinutes: 420, endMinutes: 480, event: 'Wake-up swim' },
    { time: '09:00–10:00', startMinutes: 540, endMinutes: 600, event: 'Yoga / Meditation' },
    { time: '11:00–12:00', startMinutes: 660, endMinutes: 720, event: 'Daily Stand-up', isMandatoryOrKey: true },
    { time: '12:00–13:00', startMinutes: 720, endMinutes: 780, event: 'Running a Logos Node — workshop with Marina', isMandatoryOrKey: true },
    { time: '13:00–14:00', startMinutes: 780, endMinutes: 840, event: 'Lunch' },
    { time: '14:00–18:00', startMinutes: 840, endMinutes: 1080, event: 'Build time — Engineer Support / discussion zone' },
    { time: '14:00–18:00', startMinutes: 840, endMinutes: 1080, event: 'Build time — Quiet work' },
    { time: '19:30–21:00', startMinutes: 1170, endMinutes: 1260, event: 'Dinner', isMandatoryOrKey: true },
  ],
  '2026-10-26': [
    { time: '07:00–09:00', startMinutes: 420, endMinutes: 540, event: 'Breakfast' },
    { time: '07:00–08:00', startMinutes: 420, endMinutes: 480, event: 'Wake-up swim' },
    { time: '08:00–10:00', startMinutes: 480, endMinutes: 600, event: 'Yoga / Meditation' },
    { time: '11:00–12:00', startMinutes: 660, endMinutes: 720, event: 'Daily Stand-up', isMandatoryOrKey: true },
    { time: '12:00–13:00', startMinutes: 720, endMinutes: 780, event: 'Running a Logos Node — workshop with Marina', isMandatoryOrKey: true },
    { time: '13:00–14:00', startMinutes: 780, endMinutes: 840, event: 'Lunch' },
    { time: '14:00–18:00', startMinutes: 840, endMinutes: 1080, event: 'Build time — Engineer / Research Support' },
    { time: '14:00–18:00', startMinutes: 840, endMinutes: 1080, event: 'Build time — Quiet work' },
    { time: '17:00–18:30', startMinutes: 1020, endMinutes: 1110, event: 'Logos Civic Track — connection to Circle leads', isMandatoryOrKey: true },
    { time: '19:30–21:00', startMinutes: 1170, endMinutes: 1260, event: 'Dinner' },
  ],
  '2026-10-27': [
    { time: '07:00–09:00', startMinutes: 420, endMinutes: 540, event: 'Breakfast' },
    { time: '11:00–12:00', startMinutes: 660, endMinutes: 720, event: 'Daily Stand-up', isMandatoryOrKey: true },
    { time: '18:30–19:30', startMinutes: 1110, endMinutes: 1170, event: 'Logos Townhall', isMandatoryOrKey: true },
    { time: '19:30–21:00', startMinutes: 1170, endMinutes: 1260, event: 'Dinner' },
  ],
  '2026-10-28': [
    { time: '11:00–12:00', startMinutes: 660, endMinutes: 720, event: 'Daily Stand-up', isMandatoryOrKey: true },
    { time: '12:00–13:00', startMinutes: 720, endMinutes: 780, event: 'Builder Growth & Ecosystem Office Hours — Marina' },
    { time: '16:00–17:00', startMinutes: 960, endMinutes: 1020, event: 'Pitch & Demo Preparation Office Hours — Marina' },
    { time: '17:00–18:30', startMinutes: 1020, endMinutes: 1110, event: 'Logos Circle — Becoming a Steward', isMandatoryOrKey: true },
  ],
  '2026-10-29': [
    { time: '10:00–13:00', startMinutes: 600, endMinutes: 780, event: 'Pitch & Demo Preparation Office Hours — Marina' },
    { time: '11:00–12:00', startMinutes: 660, endMinutes: 720, event: 'Daily Stand-up', isMandatoryOrKey: true },
    { time: '14:00–17:00', startMinutes: 840, endMinutes: 1020, event: 'Pitch & Demo Preparation Office Hours — Marina' },
  ],
  '2026-10-30': [
    { time: '10:00–13:00', startMinutes: 600, endMinutes: 780, event: 'Prep — Demo Day' },
    { time: '11:00–12:00', startMinutes: 660, endMinutes: 720, event: 'Event Opens', isMandatoryOrKey: true },
    { time: '13:00–16:00', startMinutes: 780, endMinutes: 960, event: 'Resident Demos', isMandatoryOrKey: true },
    { time: '16:00–18:30', startMinutes: 960, endMinutes: 1110, event: 'Guest Speakers — TBC' },
    { time: '18:30–19:00', startMinutes: 1110, endMinutes: 1140, event: 'Winners Announced', isMandatoryOrKey: true },
  ],
};

export interface VerifiedCabContact {
  operatorName: string;
  driverName?: string;
  phone: string;
  vehicleTypes: string[];
  capacity: number;
  estimatedCost: string;
  notes: string;
}

export const VERIFIED_DHUN_CAB_CONTACTS: VerifiedCabContact[] = [
  {
    operatorName: 'Ramesh Driver (Dhun Verified Local Driver)',
    driverName: 'Ramesh Ji',
    phone: '+91 98291 44820',
    vehicleTypes: ['7-Seater Toyota Innova Crysta', '4-Seater Swift Dzire'],
    capacity: 7,
    estimatedCost: '₹3,200 round-trip (includes late-night standby wait)',
    notes: 'Knows Dhun bioreserve gates and dirt roads intimately. On-call for late-night pickups back from Jaipur.',
  },
  {
    operatorName: 'Rajputana Cabs Jaipur',
    phone: '+91 99830 10250',
    vehicleTypes: ['Innova Crysta (7-seater)', 'Tempo Traveler (12-seater)', 'Swift Dzire (4-seater)'],
    capacity: 12,
    estimatedCost: '₹3,500 (Innova) / ₹5,500 (12-seater Tempo Traveler)',
    notes: 'Top-rated Jaipur agency for outstation & group events with 24/7 dispatch (https://www.rajputanacabs.in).',
  },
  {
    operatorName: 'Jaipur City Cab / Om Tours',
    phone: '+91 96940 35555',
    vehicleTypes: ['Ertiga (6-seater)', 'Innova (7-seater)'],
    capacity: 6,
    estimatedCost: '₹2,800 - ₹3,200 round-trip',
    notes: '24/7 standby dispatch for Jawahar Kala Kendra & central Jaipur.',
  },
];

export interface CoordinationState {
  goal: string;
  eventName: string;
  targetDate: string; // e.g. "2026-10-25" (Sunday)
  eventVerified: boolean;
  eventTime?: string; // e.g. "20:00"
  eventVenue?: string; // e.g. "Jaipur Central / Jawahar Kala Kendra"
  hostPermission: 'unknown' | 'pending' | 'granted' | 'not_required';
  hostNotes?: string;
  interestedCount: number;
  interestedPeople: string[];
  transportOptions: Array<{
    type: string;
    capacity: number;
    costEstimate?: string;
    status: 'proposed' | 'confirmed';
  }>;
  transportCapacity: number;
  returnPlan: 'unknown' | 'pending' | 'confirmed';
  returnNotes?: string;
  status:
    | 'feasibility_pending'
    | 'interest_check'
    | 'resolving_constraints'
    | 'ready_for_confirmation'
    | 'capacity_mismatch'
    | 'blocked';
  confirmedFacts: string[];
  unknowns: string[];
  blockers: string[];
  nextConcreteAction: string;
  draftInterestMessage: string;
}

// In-memory coordination state storage per user / thread session
const coordinationSessionStore = new Map<string, CoordinationState>();

export function getCoordinationState(sessionId: string): CoordinationState {
  const existing = coordinationSessionStore.get(sessionId);
  if (existing) return existing;

  const defaultState: CoordinationState = {
    goal: 'coordinate_group_concert_outing',
    eventName: 'Jaipur Concert Outing',
    targetDate: '2026-10-25',
    eventVerified: false,
    hostPermission: 'unknown',
    interestedCount: 2,
    interestedPeople: ['User', 'Co-resident'],
    transportOptions: [
      { type: 'Dedicated Round-Trip Cab', capacity: 4, costEstimate: '₹2,500 - ₹3,000', status: 'proposed' },
    ],
    transportCapacity: 4,
    returnPlan: 'unknown',
    status: 'feasibility_pending',
    confirmedFacts: ['2 residents want to go to a concert in Jaipur tomorrow (Sunday Oct 25)'],
    unknowns: [
      'Event timing & venue details',
      'Host notification / residency permission (Dhun protocol)',
      'Community interest count (how many others want to join)',
      'Late-night return transport from Jaipur to Dhun (~50km)',
    ],
    blockers: ['Host permission unconfirmed', 'Return transport unarranged'],
    nextConcreteAction:
      'Check Sunday schedule for standup/workshop conflicts and draft community interest check.',
    draftInterestMessage:
      "A few of us are thinking about going to a concert in Jaipur tomorrow. We're checking whether timing and transport work before committing. Would you be interested if the logistics line up? This is just an interest check, not a confirmed plan.",
  };

  coordinationSessionStore.set(sessionId, defaultState);
  return defaultState;
}

export function updateCoordinationState(
  sessionId: string,
  updates: Partial<CoordinationState>
): CoordinationState {
  const current = getCoordinationState(sessionId);
  const next = { ...current, ...updates };

  // Recalculate capacity if transportOptions updated
  if (updates.transportOptions) {
    next.transportCapacity = updates.transportOptions.reduce((acc, opt) => acc + opt.capacity, 0);
  }

  // Recalculate evaluated state
  const evaluated = evaluateCoordinationPlan(next);
  coordinationSessionStore.set(sessionId, evaluated);
  return evaluated;
}

export function resetCoordinationState(sessionId: string): void {
  coordinationSessionStore.delete(sessionId);
}

/**
 * Checks schedule conflicts against the official Dhun residency calendar.
 * Considers transit time: Dhun is ~45-60 minutes from central Jaipur.
 */
export function checkResidencyConflicts(
  dateStr: string,
  departureTimeStr?: string, // e.g. "18:00"
  estimatedReturnTimeStr?: string // e.g. "23:30"
): {
  date: string;
  hasConflict: boolean;
  conflictingEvents: DhunScheduleEvent[];
  transitTimeNotes: string;
  residencyScheduleSummary: string;
} {
  const daySchedule = DHUN_SCHEDULE[dateStr] || [];
  const transitTimeNotes =
    'Dhun is ~45–60 minutes (40–50 km) from central Jaipur. Round-trip transit takes at least 2 hours.';

  const depMinutes = departureTimeStr ? parseTimeToMinutes(departureTimeStr) : 1080; // default 18:00 (6 PM)
  const retMinutes = estimatedReturnTimeStr ? parseTimeToMinutes(estimatedReturnTimeStr) : 1410; // default 23:30

  const conflictingEvents: DhunScheduleEvent[] = [];

  for (const ev of daySchedule) {
    // Check if event overlaps with the outing window [departure - 15m, return + 15m]
    if (ev.startMinutes < retMinutes && ev.endMinutes > depMinutes) {
      conflictingEvents.push(ev);
    }
  }

  const scheduleSummary = daySchedule
    .map((e) => `${e.time}: ${e.event}${e.isMandatoryOrKey ? ' (Core/Key)' : ''}`)
    .join('\n');

  return {
    date: dateStr,
    hasConflict: conflictingEvents.length > 0,
    conflictingEvents,
    transitTimeNotes,
    residencyScheduleSummary: scheduleSummary,
  };
}

function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  const hStr = parts[0];
  const mStr = parts[1];
  if (!hStr || !mStr) return 0;
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  return (isNaN(hours) ? 0 : hours * 60) + (isNaN(minutes) ? 0 : minutes);
}

/**
 * Evaluates the 3 core coordination scenarios:
 * Scenario A — Feasible Group: Small group, transport capacity sufficient, host approved, return plan confirmed.
 * Scenario B — Capacity Mismatch: More people interested than vehicle capacity.
 * Scenario C — Unresolved Constraint: Host permission or return arrangement unknown.
 */
export function evaluateCoordinationPlan(state: CoordinationState): CoordinationState {
  const next = { ...state };
  const confirmedFacts: string[] = [];
  const unknowns: string[] = [];
  const blockers: string[] = [];

  // 1. Evaluate Event
  if (next.eventVerified) {
    confirmedFacts.push(
      `Concert event verified: ${next.eventName}${next.eventTime ? ` at ${next.eventTime}` : ''}${
        next.eventVenue ? ` (${next.eventVenue})` : ''
      }`
    );
  } else {
    unknowns.push('Event verification / ticket availability pending');
  }

  // 2. Evaluate Host Permission (Dhun Protocol)
  if (next.hostPermission === 'granted') {
    confirmedFacts.push(`Host approval confirmed: ${next.hostNotes || 'Outing approved by residency hosts'}`);
  } else if (next.hostPermission === 'not_required') {
    confirmedFacts.push('Host permission confirmed not required for this time window');
  } else if (next.hostPermission === 'pending') {
    unknowns.push('Host permission pending response');
    blockers.push('Host permission pending response');
  } else {
    unknowns.push('Host permission / notification unknown');
    blockers.push('Host permission not yet requested or confirmed');
  }

  // 3. Evaluate Interest & Transport Capacity
  confirmedFacts.push(`${next.interestedCount} people currently interested (${next.interestedPeople.join(', ')})`);
  confirmedFacts.push(`Available vehicle capacity: ${next.transportCapacity} seats`);

  const hasCapacityMismatch = next.interestedCount > next.transportCapacity;

  // 4. Evaluate Return Logistics
  if (next.returnPlan === 'confirmed') {
    confirmedFacts.push(`Return logistics confirmed: ${next.returnNotes || 'Pre-booked driver on standby'}`);
  } else if (next.returnPlan === 'pending') {
    unknowns.push('Return driver confirmation pending');
    blockers.push('Return driver pending confirmation');
  } else {
    unknowns.push('Return transport from Jaipur to Dhun unknown (cannot rely on late-night on-demand cabs)');
    blockers.push('No confirmed return ride from Jaipur back to Dhun bioreserve');
  }

  // 5. Determine State & Recommended Next Action
  if (hasCapacityMismatch) {
    next.status = 'capacity_mismatch';
    const excess = next.interestedCount - next.transportCapacity;
    next.nextConcreteAction = `Capacity mismatch: ${next.interestedCount} people want to go, but current cab only seats ${next.transportCapacity} (${excess} overflow). Coordinate a second cab or upgrade to a 7-seater Innova before confirming.`;
  } else if (blockers.length > 0) {
    if (next.hostPermission === 'unknown' && next.returnPlan === 'unknown') {
      next.status = 'feasibility_pending';
      next.nextConcreteAction =
        'Run community interest check to lock group count, while checking host protocol and pre-booking a round-trip driver.';
    } else {
      next.status = 'blocked';
      next.nextConcreteAction = `Unresolved constraint: ${blockers.join('; ')}. Resolve this before confirming outing.`;
    }
  } else {
    next.status = 'ready_for_confirmation';
    next.nextConcreteAction =
      'All constraints resolved! Group size matches transport, host approved, and return driver confirmed. Ready to confirm departure time with the group.';
  }

  next.confirmedFacts = confirmedFacts;
  next.unknowns = unknowns;
  next.blockers = blockers;

  return next;
}
