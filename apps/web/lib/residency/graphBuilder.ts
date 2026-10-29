// apps/web/lib/residency/graphBuilder.ts
// Builds the 3-node Obsidian-style social graph and 2 edge families for Force Dhun Residency

import type {
  ResidencyIntentSnapshot,
  ResidencyGraphData,
  ResidencyGraphNode,
  ResidencyGraphEdge,
  ConnectionDetail,
  ResidentConnectionType,
} from './types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds canonical 3-node graph:
 * Node Types: 'person', 'intent_problem', 'theme_approach'
 * Edge Families:
 * 1. 'structural': (person -> intent, intent -> theme)
 * 2. 'resident_connection': cross-resident links based on complementary approaches, shared problems, and contributions
 */
export function buildResidencyGraph(
  snapshots: ResidencyIntentSnapshot[],
  cohortId = 'dhun-oct-2026'
): ResidencyGraphData {
  const nodes: ResidencyGraphNode[] = [];
  const edges: ResidencyGraphEdge[] = [];
  const nodeIds = new Set<string>();

  const addNode = (node: ResidencyGraphNode) => {
    if (!nodeIds.has(node.id)) {
      nodeIds.add(node.id);
      nodes.push(node);
    }
  };

  // 1. Generate structural nodes and edges for each resident
  for (const snap of snapshots) {
    const personId = `person:${snap.user_id}`;
    const intentId = `intent:${snap.user_id}`;

    // A. Person Node
    addNode({
      id: personId,
      type: 'person',
      label: snap.user_name || (snap.user_id.replace(/^user_/, '').charAt(0).toUpperCase() + snap.user_id.replace(/^user_/, '').slice(1)),
      summary: snap.current_frontier || snap.intent,
      owner_user_id: snap.user_id,
      metadata: {
        avatar_url: snap.avatar_url,
        social_links: snap.social_links,
        can_offer: snap.contribution?.can_offer || [],
        seeking: snap.contribution?.seeking || [],
      },
    });

    // B. Intent / Problem Node
    const shortIntent = snap.intent.length > 55 ? `${snap.intent.slice(0, 52)}...` : snap.intent;
    addNode({
      id: intentId,
      type: 'intent_problem',
      label: shortIntent,
      summary: `Intent: ${snap.intent}\n\nCore Challenge: ${snap.problem}`,
      owner_user_id: snap.user_id,
    });

    // Structural Edge: Person -> Intent
    edges.push({
      id: `edge:${personId}:${intentId}`,
      source: personId,
      target: intentId,
      family: 'structural',
      type: 'person_has_intent',
      strength: 1.0,
      why_connected: 'Resident driving this core intent',
    });

    // C. Theme / Approach Nodes
    const approaches = Array.isArray(snap.approach) ? snap.approach : [];
    for (const app of approaches) {
      if (!app || typeof app !== 'string') continue;
      const themeSlug = slugify(app);
      const themeId = `theme:${themeSlug}`;

      addNode({
        id: themeId,
        type: 'theme_approach',
        label: app,
        summary: `Approach explored in cohort: ${app}`,
      });

      // Structural Edge: Intent -> Theme
      edges.push({
        id: `edge:${intentId}:${themeId}`,
        source: intentId,
        target: themeId,
        family: 'structural',
        type: 'intent_has_theme',
        strength: 0.8,
        why_connected: `Approach utilized for problem exploration: ${app}`,
      });
    }
  }

  // 2. Discover Cross-Resident Connections (family: 'resident_connection')
  for (let i = 0; i < snapshots.length; i++) {
    for (let j = i + 1; j < snapshots.length; j++) {
      const snapA = snapshots[i];
      const snapB = snapshots[j];
      if (!snapA || !snapB) continue;

      const personA = `person:${snapA.user_id}`;
      const personB = `person:${snapB.user_id}`;

      // Check contribution matches: seeking vs can_offer
      const aOffers = snapA.contribution?.can_offer || [];
      const aSeeks = snapA.contribution?.seeking || [];
      const bOffers = snapB.contribution?.can_offer || [];
      const bSeeks = snapB.contribution?.seeking || [];

      const complementaryOffer = aOffers.some((o) => bSeeks.some((s) => s.toLowerCase().includes(o.toLowerCase()) || o.toLowerCase().includes(s.toLowerCase()))) ||
        bOffers.some((o) => aSeeks.some((s) => s.toLowerCase().includes(o.toLowerCase()) || o.toLowerCase().includes(s.toLowerCase())));

      // Check shared approaches
      const aApproaches = (snapA.approach || []).map((x) => x.toLowerCase());
      const bApproaches = (snapB.approach || []).map((x) => x.toLowerCase());
      const sharedApproach = aApproaches.some((x) => bApproaches.some((y) => x.includes(y) || y.includes(x)));

      if (complementaryOffer) {
        edges.push({
          id: `conn:${snapA.user_id}:${snapB.user_id}:contrib`,
          source: personA,
          target: personB,
          family: 'resident_connection',
          type: 'potential_contribution',
          strength: 0.9,
          why_connected: 'Complementary skills and active learning goals create high-leverage collaboration.',
          what_to_explore: `How can ${snapA.user_name || 'Resident A'} and ${snapB.user_name || 'Resident B'} combine their expertise on verifiable workflows?`,
          evidence_refs: [snapA.intent, snapB.intent],
        });
      } else if (sharedApproach) {
        edges.push({
          id: `conn:${snapA.user_id}:${snapB.user_id}:approach`,
          source: personA,
          target: personB,
          family: 'resident_connection',
          type: 'complementary_approach',
          strength: 0.75,
          why_connected: 'Shared conceptual framework and investigative methodology.',
          what_to_explore: 'Where do your approaches diverge when stress-tested against real user feedback?',
          evidence_refs: [snapA.intent, snapB.intent],
        });
      } else {
        // Fallback exploration edge for cohort cohesion
        edges.push({
          id: `conn:${snapA.user_id}:${snapB.user_id}:explore`,
          source: personA,
          target: personB,
          family: 'resident_connection',
          type: 'shared_exploration',
          strength: 0.6,
          why_connected: 'Both working on autonomy, human agency, and systemic clarity at Dhun.',
          what_to_explore: 'What unexpected overlap exists between your problem frontiers?',
          evidence_refs: [snapA.intent, snapB.intent],
        });
      }
    }
  }

  return {
    cohort_id: cohortId,
    nodes,
    edges,
  };
}

/**
 * Returns explainable connection details between two residents.
 */
export function getConnectionDetail(
  userIdA: string,
  userIdB: string,
  snapshots: ResidencyIntentSnapshot[]
): ConnectionDetail | null {
  const snapA = snapshots.find((s) => s.user_id === userIdA);
  const snapB = snapshots.find((s) => s.user_id === userIdB);

  if (!snapA || !snapB) return null;

  const aOffers = snapA.contribution?.can_offer || [];
  const aSeeks = snapA.contribution?.seeking || [];
  const bOffers = snapB.contribution?.can_offer || [];
  const bSeeks = snapB.contribution?.seeking || [];

  let relationshipType: ResidentConnectionType = 'shared_exploration';
  let whyConnected = `${snapA.user_name || 'Resident A'} and ${snapB.user_name || 'Resident B'} share foundational commitments to agency and intentional systems.`;
  let whatToExplore = 'How do your problem frontiers intersect during active residency build blocks?';

  const hasSkillMatch = aOffers.some((o) => bSeeks.some((s) => s.toLowerCase().includes(o.toLowerCase()) || o.toLowerCase().includes(s.toLowerCase()))) ||
    bOffers.some((o) => aSeeks.some((s) => s.toLowerCase().includes(o.toLowerCase()) || o.toLowerCase().includes(s.toLowerCase())));

  if (hasSkillMatch) {
    relationshipType = 'potential_contribution';
    whyConnected = 'Direct symmetry between what one resident can offer and what the other is actively seeking.';
    whatToExplore = `Can ${snapA.user_name || 'Resident A'} critique ${snapB.user_name || 'Resident B'}'s architectural frontier to accelerate validation?`;
  } else if ((snapA.approach || []).some((x) => (snapB.approach || []).some((y) => x.toLowerCase() === y.toLowerCase()))) {
    relationshipType = 'complementary_approach';
    whyConnected = 'Shared methodological principles applied across distinct problem frontiers.';
    whatToExplore = 'What shared mental models can you co-design for the cohort?';
  }

  return {
    connection_id: `conn_${userIdA}_${userIdB}`,
    relationship_type: relationshipType,
    source_resident: {
      id: snapA.user_id,
      name: snapA.user_name || snapA.user_id,
      avatar_url: snapA.avatar_url,
    },
    target_resident: {
      id: snapB.user_id,
      name: snapB.user_name || snapB.user_id,
      avatar_url: snapB.avatar_url,
    },
    why_connected: whyConnected,
    what_to_explore: whatToExplore,
    evidence: {
      source_excerpt: snapA.current_frontier || snapA.problem,
      target_excerpt: snapB.current_frontier || snapB.problem,
    },
  };
}

