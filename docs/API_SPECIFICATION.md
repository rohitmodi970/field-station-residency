# Field Station Residency — API Specification (v1.1)

This document provides the complete API contract and schema specification for the Field Station Residency backend.

---

## 1. Intent Synthesis
### `POST /api/residency/intent/synthesize`
Generates an unapproved, provisional Intent Snapshot from the resident's three answers, optional contribution tags, Onairos context, and public footprint.

#### Request Body
```json
{
  "resident_id": "r_1793303990037",
  "name": "Rohit Modi",
  "cohort_id": "dhun-oct-2026",
  "answers": [
    "By the end of this residency, I want to build verifiable autonomous memory agents.",
    "Bridging cognitive theories into verifiable lightweight local systems for genuine human agency.",
    "Designing dynamic graph retrieval that scales gracefully without cluttering mental bandwidth."
  ],
  "contribution": {
    "can_offer": ["Skills", "Experience", "Tools"],
    "seeking": ["Feedback", "A skill", "An introduction"]
  },
  "links": ["https://github.com/rohitmodi970", "https://linkedin.com/in/rohitmodi970"],
  "onairos": {
    "archetype": "The Curious Builder",
    "summary": "A curious maker who learns by talking to people.",
    "positive": [
      { "name": "Curiosity", "strength": 92 },
      { "name": "Persistence", "strength": 84 }
    ],
    "coverage": { "label": "20% coverage", "items_read": 240, "items_total": 1200 }
  }
}
```

#### Response (`200 OK`)
```json
{
  "id": "snap_1793303990037_kxdwy",
  "resident_id": "r_1793303990037",
  "name": "Rohit Modi",
  "intent": "Build verifiable autonomous memory agents that empower human agency.",
  "problem": "Bridging abstract cognitive theories into lightweight local systems without bloat.",
  "approach": ["SimpleMem", "TypeScript / Supabase", "Pragmatic HCI"],
  "current_frontier": "Designing dynamic graph retrieval that scales gracefully without clutter.",
  "contribution": {
    "can_offer": ["Skills", "Experience", "Tools"],
    "seeking": ["Feedback", "A skill", "An introduction"]
  },
  "next_step": {
    "text": "Sketch the 3 Supabase tables on paper before coding the local graph.",
    "why_it_may_help": "Clarifies data boundaries and prevents over-engineering.",
    "status": "suggested"
  },
  "status": "pending_review",
  "shared": false
}
```

---

## 2. Intent Approval & Visibility
### `POST /api/residency/intent/approve`
Approves the synthesized Intent Snapshot, saves user edits, and updates cohort sharing consent.

#### Request Body
```json
{
  "snapshot_id": "snap_1793303990037_kxdwy",
  "resident_id": "r_1793303990037",
  "user_name": "Rohit Modi",
  "cohort_id": "dhun-oct-2026",
  "sharing_consent": true,
  "shared": true,
  "fields": {
    "intent": "Build verifiable autonomous memory agents that empower human agency.",
    "problem": "Bridging abstract cognitive theories into lightweight local systems without bloat.",
    "approach": ["SimpleMem", "TypeScript / Supabase", "Pragmatic HCI"],
    "current_frontier": "Designing dynamic graph retrieval that scales gracefully without clutter.",
    "persona": {
      "archetype": "The Curious Builder",
      "summary": "A curious maker who learns by talking to people.",
      "positive": [{ "name": "Curiosity", "strength": 92 }]
    }
  }
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "status": "user_approved",
  "sharing_consent": true,
  "message": "Snapshot approved and shared with cohort.",
  "snapshot": { ... }
}
```

---

## 3. Cohort Graph & Residents
### `GET /api/residency/graph`
Returns cohort-visible nodes, edges, approved snapshots, and real resident profiles from Supabase.

#### Response (`200 OK`)
```json
{
  "nodes": [
    { "id": "person_user_rohit", "name": "Rohit Modi", "art": "hills", "radius": 32 }
  ],
  "edges": [
    { "source": "person_user_rohit", "target": "person_user_srinjoy", "type": "shared_problem" }
  ],
  "residents": [
    { "id": "user_rohit", "name": "Rohit Modi", "art": "hills", "work": "Zero-knowledge security, auth and state persistence" }
  ],
  "snapshots": [ ... ]
}
```

---

## 4. Companion Chat Agent
### `POST /api/residency/companion/chat`
Conducts live, 1-on-1 dialogue with longitudinal memory grounding, peer recommendations, and memory capture.

#### Request Body
```json
{
  "message": "I'm figuring out how to cache local graph indices without memory bloat.",
  "resident_id": "r_1793303990037",
  "user_context": {
    "name": "Rohit Modi",
    "intent": "Build verifiable autonomous memory agents",
    "problem": "Memory retrieval latency in local systems",
    "archetype": "The Curious Builder"
  }
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "text": "Keep the graph flat until queries demand deep nesting. Have you considered SQLite with virtual tables for index pruning?",
  "options": [
    { "label": "Map this", "go": "pattern" },
    { "label": "Talk to Srinjoy", "go": "connection:user_srinjoy" }
  ],
  "note": "Noted: SQLite virtual tables"
}
```

---

## 5. Audio Transcription
### `POST /api/transcribe`
Transcribes audio recordings using Deepgram Nova-2 with fallback to ElevenLabs Scribe v2.

#### Request Body (Multipart)
* `file`: Audio blob (`audio/webm` or `audio/mp4`).

#### Response (`200 OK`)
```json
{
  "text": "By the end of this residency, I want to build verifiable autonomous memory agents.",
  "source": "deepgram_nova_2"
}
```

