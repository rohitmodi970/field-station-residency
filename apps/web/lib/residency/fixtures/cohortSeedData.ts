// apps/web/lib/residency/fixtures/cohortSeedData.ts
// Known-good seed cohort for Dhun Residency (5 Opted-In Residents)

import type { ResidencyIntentSnapshot } from '../types';

export const DHUN_COHORT_SEED_SNAPSHOTS: ResidencyIntentSnapshot[] = [
  {
    id: "snap_srinjoy_001",
    user_id: "user_srinjoy",
    cohort_id: "dhun-oct-2026",
    intent: "Build verifiable autonomous memory agents that empower genuine human agency rather than synthetic dependency.",
    problem: "Bridging abstract cognitive theories (mentalizing, knowledge graphs) into verifiable, lightweight local systems (SimpleMem) without over-engineering.",
    approach: ["SimpleMem", "TypeScript / Supabase", "Pragmatic HCI", "Local State"],
    current_frontier: "Designing dynamic graph retrieval that scales gracefully without cluttering the resident's mental bandwidth.",
    contribution: {
      can_offer: ["Agentic memory architectures", "Full-stack execution", "Database design"],
      seeking: ["Cognitive psychology critique", "User testing from non-technical residents"]
    },
    next_step: {
      text: "Sketch the 3 Supabase tables on paper before coding the local graph.",
      why_it_may_help: "Clarifies data boundaries and prevents over-engineering.",
      status: "accepted"
    },
    provenance: {
      intent: ["user_answer:q1"],
      problem: ["user_answer:q2"],
      approach: ["user_answer", "onairos:positive_traits"],
      current_frontier: ["user_answer:q3"],
      contribution: ["user_explicit:can_offer", "user_explicit:seeking"]
    },
    status: "user_approved",
    sharing_consent: true,
    approved_at: "2026-10-28T18:00:00.000Z",
    created_at: "2026-10-28T17:30:00.000Z",
    updated_at: "2026-10-28T18:00:00.000Z"
  },
  {
    id: "snap_shriyanshi_002",
    user_id: "user_shriyanshi",
    cohort_id: "dhun-oct-2026",
    intent: "Enable humans to maintain intentional agency in an increasingly AI-mediated cognitive environment.",
    problem: "AI interactions encourage passive reliance or impulsive assumptions rather than supporting critical reflection and mentalizing boundaries.",
    approach: ["Cognitive Psychology", "Mentalizing Boundaries", "Human-Centered Design"],
    current_frontier: "Designing UX boundaries that pause impulsive action and encourage deliberate, grounded reflection.",
    contribution: {
      can_offer: ["Psychological grounding", "Product strategy", "Qualitative research"],
      seeking: ["Verifiable backend memory systems", "Local graph data architectures"]
    },
    next_step: {
      text: "Review the 5-field snapshot wording with the first 3 onboarded residents.",
      why_it_may_help: "Ensures the UX labels resonate as authentic rather than robotic.",
      status: "suggested"
    },
    provenance: {
      intent: ["user_answer:q1"],
      problem: ["user_answer:q2"],
      approach: ["user_answer"],
      current_frontier: ["user_answer:q3"]
    },
    status: "user_approved",
    sharing_consent: true,
    approved_at: "2026-10-28T18:15:00.000Z",
    created_at: "2026-10-28T17:45:00.000Z",
    updated_at: "2026-10-28T18:15:00.000Z"
  },
  {
    id: "snap_rohit_003",
    user_id: "user_rohit",
    cohort_id: "dhun-oct-2026",
    intent: "Build production-grade security, auth, and state persistence for longitudinal AI context.",
    problem: "Balancing zero-knowledge client encryption with server-side AI synthesis and multi-user performance.",
    approach: ["Hybrid Cryptography", "Supabase RLS", "System Reliability"],
    current_frontier: "Key rotation across shared collaborative context without server-side plaintext leakage.",
    contribution: {
      can_offer: ["Security architecture", "Database optimization", "Performance auditing"],
      seeking: ["Stress testing with active live collaborative sessions"]
    },
    next_step: {
      text: "Audit the Supabase RLS policies for residency graph edge permissions.",
      why_it_may_help: "Ensures unshared snapshots are strictly isolated at the database level.",
      status: "suggested"
    },
    provenance: {
      intent: ["user_answer:q1"],
      problem: ["user_answer:q2"],
      approach: ["user_answer"],
      current_frontier: ["user_answer:q3"]
    },
    status: "user_approved",
    sharing_consent: true,
    approved_at: "2026-10-28T18:30:00.000Z",
    created_at: "2026-10-28T18:00:00.000Z",
    updated_at: "2026-10-28T18:30:00.000Z"
  },
  {
    id: "snap_arushi_004",
    user_id: "user_arushi",
    cohort_id: "dhun-oct-2026",
    intent: "Transform complex inter-personal cognitive data into an intuitive, tactile spatial interface.",
    problem: "Visual graphs often become cluttered, overwhelming visual noise instead of clear mental clarity.",
    approach: ["Obsidian-Inspired Local Graphs", "Mobile Haptics", "React Native SVG"],
    current_frontier: "Calibrating spring physics so local neighborhoods expand smoothly without jarring camera shifts.",
    contribution: {
      can_offer: ["Mobile UI/UX", "Interactive SVG visualization", "Motion design"],
      seeking: ["Structured edge data with pre-calculated semantic weights"]
    },
    next_step: {
      text: "Test 1-hop neighborhood dimming on mobile screens with 15 nodes.",
      why_it_may_help: "Verifies readability on smaller smartphone displays.",
      status: "suggested"
    },
    provenance: {
      intent: ["user_answer:q1"],
      problem: ["user_answer:q2"],
      approach: ["user_answer"],
      current_frontier: ["user_answer:q3"]
    },
    status: "user_approved",
    sharing_consent: true,
    approved_at: "2026-10-28T18:45:00.000Z",
    created_at: "2026-10-28T18:10:00.000Z",
    updated_at: "2026-10-28T18:45:00.000Z"
  },
  {
    id: "snap_nitesh_005",
    user_id: "user_nitesh",
    cohort_id: "dhun-oct-2026",
    intent: "Explore the epistemic boundaries of AI agent representatives in real-world human coordination.",
    problem: "Lack of local verifiable mechanisms to test whether an AI agent's recommendations align with human truth or hallucinated assumptions.",
    approach: ["Epistemology", "Agent Benchmarking", "Local Verifiability"],
    current_frontier: "Formulating falsifiable metrics for agent conversational value.",
    contribution: {
      can_offer: ["Epistemic evaluation", "Theoretical inquiry", "Agent testing environments"],
      seeking: ["Real-world cohort testbeds with multi-agent interactions"]
    },
    next_step: {
      text: "Draft a 1-page rubric for evaluating agent suggestion accuracy.",
      why_it_may_help: "Provides a benchmark for testing residency connection quality.",
      status: "suggested"
    },
    provenance: {
      intent: ["user_answer:q1"],
      problem: ["user_answer:q2"],
      approach: ["user_answer"],
      current_frontier: ["user_answer:q3"]
    },
    status: "user_approved",
    sharing_consent: true,
    approved_at: "2026-10-28T19:00:00.000Z",
    created_at: "2026-10-28T18:20:00.000Z",
    updated_at: "2026-10-28T19:00:00.000Z"
  }
];

export const DHUN_RESIDENT_PROFILES: Record<string, { name: string; avatar: string; role: string }> = {
  user_srinjoy: {
    name: "Srinjoy Sen Chowdhury",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    role: "Full-Stack AI & Memory Architect"
  },
  user_shriyanshi: {
    name: "Shriyanshi Shikha",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    role: "Cognitive Systems & Agency Lead"
  },
  user_rohit: {
    name: "Rohit Modi",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    role: "Security & Platform Engineer"
  },
  user_arushi: {
    name: "Arushi",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    role: "Spatial UX & Visual Interaction"
  },
  user_nitesh: {
    name: "Nitesh",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    role: "AI Epistemology & Agent Representative"
  }
};
