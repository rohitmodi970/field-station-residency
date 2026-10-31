# 📋 Field Station Residency: Cohort Participation & Database Census Report

> **Document Type:** Production Telemetry & Resident Participation Audit  
> **Repository:** [https://github.com/rohitmodi970/field-station-residency.git](https://github.com/rohitmodi970/field-station-residency.git)  
> **Database:** Live Supabase Production (`residency_participants`, `residency_entries`)  
> **Audit Date:** November 2026  
> **Status:** Verified Live Data  

---

## 1. Executive Summary

A comprehensive query of the live Supabase production database was performed to determine the exact number of participants, onboarding completion rates, answers submitted across the 3 residency prompts, and Onairos profile connections.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        COHORT CENSUS TOTALS                            │
├─────────────────────────────────────────────────┬──────────────────────┤
│ Metric                                          │ Live Production Count│
├─────────────────────────────────────────────────┼──────────────────────┤
│ Total Participant Records (residency_participants)│ 27 records           │
│ Total Individual Answer Entries (residency_entries)│ 97 entries           │
│ Distinct Human Residents / Participants         │ 11 unique users      │
│ Real Project Submissions (Detailed Intent)      │ 7 residents          │
│ Platform Team & Testing Profiles                │ 4 participants       │
│ Onairos Identity Connections                    │ 100% of participants │
└─────────────────────────────────────────────────┴──────────────────────┘
```

---

## 2. Participant Census & Submission Registry

The table below catalogs every unique resident identified in the database, their onboarding attempt count, verification status, and their primary submitted project intent:

| Resident Name | Total Attempts | Total Entries | Onairos Connected | Primary Submitted Project Intent / Focus | Latest Timestamp (UTC) |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Disha** | 2 | 3 | ✅ Yes | **AI Safety & Unconventional Computing**: Exploring dynamic systems and computational limitations via simulation. | 2026-10-31 06:39 |
| **megabyte** | 2 | 3 | ✅ Yes | **C-Cash / Open Source Crypto**: Network offline gas transferability; building security and scalability proof-of-concept. | 2026-10-31 06:20 |
| **Hiro** | 1 | 3 | ✅ Yes | **Trails & Human Identity App**: Helping individuals discover their core identity and making mobile trails accessible. | 2026-10-31 05:26 |
| **Abhinav Dey** | 2 | 3 | ✅ Yes | **Agri/Climate Community Quality Standards**: Real-time production data monitoring and supply chain quality principles. | 2026-10-30 13:53 |
| **Arushi Upmanyu** | 3 | 3 | ✅ Yes | **Art-Tech Object Series & Design**: Converging divergent creative/tech industries *(Archetype: Aesthetic Architect)*. | 2026-10-30 08:32 |
| **Shriyanshi** | 5 | 9 | ✅ Yes | **Human Connection & Memory**: Building longitudinal memory systems that give humans sovereign control over their context. | 2026-10-30 10:19 |
| **shrishti** | 1 | 3 | ✅ Yes | **Human-Animal Collaboration**: Designing coliving habitats, spaces, and ecosystems for interspecies harmony. | 2026-10-30 03:13 |
| **Resident (Deep Learning)** | 4 | 3 | ✅ Yes | **Grounded Deep Learning Representations**: Decision tracking models constrained by physical world rules for AI safety. | 2026-10-30 11:14 |
| **Shardul** | 1 | — | ✅ Yes | Onboarded and verified Onairos profile connection. | 2026-10-30 10:36 |
| **Srinjoy** | 4 | 6 | ✅ Yes | Engineering pipeline verification and onboarding workflow integration. | 2026-10-31 17:28 |
| **Rohit Modi** | 2 | 3 | ✅ Yes | Platform testing, intent synthesis, and graph edge validation. | 2026-10-30 08:59 |

---

## 3. Verbatim Submissions (The 3 Core Residency Questions)

Below are verbatim excerpts of resident submissions recorded in `residency_participants.answers` and `residency_entries`:

### 1. Disha
* **Q1 (What are you working on?):** *"Towards AI safety and it matters because AI is taking over the world and it's important to understand where it's heading."*
* **Q2 (What problem are you solving?):** *"Basically unconventional computing, SLT, computational limitations, and dynamic systems."*
* **Q3 (How are you approaching it?):** *"I'm trying to explore computation by running simulations and taking empirical data."*

### 2. megabyte
* **Q1 (What are you working on?):** *"Yeah I am working on C-Cash contributing to open source, it matters to me because it gives financial and communication access."*
* **Q2 (What problem are you solving?):** *"I'm focused on network offline gas transferability problem right now to help users in low-connectivity areas."*
* **Q3 (How are you approaching it?):** *"I built a proof-of-concept and now will be working on security and scalability."*

### 3. Hiro
* **Q1 (What are you working on?):** *"I am working on a trails app."*
* **Q2 (What problem are you solving?):** *"I am working on helping humans discover their identity."*
* **Q3 (How are you approaching it?):** *"So far it's been good, I'm still trying to make it accessible for non-iOS users."*

### 4. Abhinav Dey
* **Q1 (What are you working on?):** *"I am working with people in agri, climate, energy, and tech to build community-centric quality standards."*
* **Q2 (What problem are you solving?):** *"I am trying to understand quality principles of community, similar to how Japan has TQM and Six Sigma."*
* **Q3 (How are you approaching it?):** *"I am figuring out how real-time production data monitoring can lead to more fulfilled supply chains."*

### 5. Arushi Upmanyu
* **Q1 (What are you working on?):** *"I'm working on an object series that is a reflection of art and tech advancements together."*
* **Q2 (What problem are you solving?):** *"Opportunity of pushing limits and converging two divergent industries."*
* **Q3 (How are you approaching it?):** *"Talking to people, understanding the implementation, still working on the prototype."*
* **Onairos Archetype:** *Aesthetic Architect* (Dominant traits: Visual Design Enthusiast 95%, Culinary Curator 92%, Brand Builder 88%, Tech-Creative Hybrid 85%).

### 6. Shriyanshi
* **Q1 (What are you working on?):** *"I am working toward building Force right now and it matters to me because it has emerged out of my lived experience."*
* **Q2 (What problem are you solving?):** *"I am focused on solving the problem of human connections and whether AI can help humans communicate more authentically."*
* **Q3 (How are you approaching it?):** *"I am approaching it by building longitudinal memory for the user that they retain sovereign control over."*

### 7. shrishti
* **Q1 (What are you working on?):** *"I want to work on human-animal collaboration, and from the residency I want to understand the possibilities."*
* **Q2 (What problem are you solving?):** *"I am focused on designing spaces and ecosystems for coliving habitats."*
* **Q3 (How are you approaching it?):** *"I have an idea and a lot of open questions that I am exploring through physical and system design."*

---

## 4. Database Architecture & Audit Methodology

The telemetry in this report was verified through raw queries directly to the Supabase PostgREST layer:

1. **`residency_participants`**: Primary entity table storing resident identity, email, social links, `answers` JSON, `audio_clips` array, `onairos_status`, and `onairos_data`.
2. **`residency_entries`**: Normalized row-level table mapping each prompt answer to themes, title, content blocks, and timestamps (`97` rows).
3. **`residency_intent_snapshots`**: Stores synthesized intent snapshots (`intent`, `problem`, `approach`, `positive_traits`, `archetype`, and `sharing_consent`).
4. **Linkage Key**: Residents are tracked via both server UUID (`id`) and immutable client session identifier (`unique_id`), ensuring integrity across web and mobile endpoints.
