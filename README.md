# Field Station Residency

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black)](https://nextjs.org/)
[![Expo](https://img.shields.io/badge/Expo-~54.0-blue)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.81.5-61dafb)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8)](https://tailwindcss.com/)

> **Field Station Residency** is an ambient cognitive intelligence platform designed for resident cohorts. It features an audio-first onboarding journey, AI-powered intent synthesis, behavioral profiling via Onairos, a 3D spherical cohort graph, automated peer connection discovery, and an intelligent companion agent.

---

## 🏛️ Monorepo Architecture

This repository is organized as a unified `pnpm` monorepo containing both the web platform and the native mobile campaign:

```text
field-station-residency/
├── apps/
│   ├── web/                         # Full Next.js Web App for Field Station Residency
│   │   ├── app/                     # App Router
│   │   │   ├── field-station-residency/ # Main residency experience entry point
│   │   │   ├── (onboarding)/        # Multi-stage onboarding & baseline flows
│   │   │   ├── connect/             # Connector and linking hub
│   │   │   ├── residency/           # Living UI & 3D cohort graph view
│   │   │   └── api/residency/       # Complete backend API suite
│   │   │
│   │   ├── components/              # Full component architecture
│   │   │   ├── r/                   # Residency UI (Traits, Persona, Connection, Onboarding)
│   │   │   ├── f/                   # Living UI primitives (Glass, Bubbles, VoiceMode, Marks)
│   │   │   ├── onBoarding/          # Onboarding v2 flow, OnairosButton, step frames
│   │   │   ├── companion/           # Proactive companion cards, toasts, and views
│   │   │   ├── shared-cognition/    # Consent mediation, connections panel, identity blocks
│   │   │   ├── voiceAnalysis/       # Emotion tabs, energy waveforms, speech analytics
│   │   │   ├── audio-analysis/      # Acoustic visualizations and D3 mind maps
│   │   │   ├── Journal/             # Audio reflection displays and analyzers
│   │   │   ├── layout/              # ForcePageShell, Header, Navigation
│   │   │   ├── Loader/              # Tactile loaders & BookPageTurner
│   │   │   ├── spotlight/           # Greeting hero, insight cards, activity scores
│   │   │   └── ui/                  # Ambient backgrounds, docks, dialogs, cards, tabs
│   │   │
│   │   ├── contract/                # Type definitions, v1.1 schemas, and cohort fixtures
│   │   ├── lib/                     # Client stores, enrichment, analysis, and LLM utilities
│   │   ├── services/                # Hume AI, Deepgram, and acoustic processing services
│   │   ├── utilities/               # Prosody parsers, audio validation, and context helpers
│   │   ├── server/claude.ts         # Anthropic Claude inference engine (Haiku 4.5 / Opus)
│   │   └── styles/                  # Design tokens and residency styling
│   │
│   └── residency-campaign/          # Expo / React Native Mobile Application
│       ├── app/                     # Expo Router file-based screens
│       ├── src/components/f/        # Skia canvas, Living UI marks, and bubbles
│       ├── src/components/r/        # Native swipe cards, persona views, and onboarding
│       ├── src/stores/              # Zustand persistent state with MMKV / AsyncStorage
│       └── src/lib/                 # Spherical math, audio metering, and API client
│
├── docs/                            # Complete architectural and implementation guides
│   ├── PORTING.md                   # Guide for porting web primitives to React Native / Skia
│   ├── API_SPECIFICATION.md         # v1.1 residency contract and endpoint reference
│   └── ONBOARDING_ARCHITECTURE.md   # Intent synthesis & cohort graph projection pipeline
│
├── .env.example                     # Environment variable templates (zero secrets committed)
├── pnpm-workspace.yaml              # Monorepo workspace configuration
└── LICENSE                          # MIT License
```

---

## 🌟 Key Features

### 1. 🎙️ 3-Question Multi-Modal Onboarding
Residents join by answering three focused questions via speech or text:
1. *What are you working toward right now, and why does it matter to you?*
2. *What problem, question, or opportunity are you focused on?*
3. *How are you approaching it so far and what are you still trying to figure out?*

Real-time audio processing measures energy levels, speech pace (WPM), and cognitive hesitations without diagnostic scoring.

### 2. 🧩 Behavioral Profiling via Onairos (`v8.12.4`)
* Connects securely to the resident's applications to extract cognitive strengths, working archetypes, and co-occurrence rationale.
* **"How you come across" UI**: Side-by-side strengths tiles with dusk art icons, explanatory narrative card, and data reading coverage meter.
* **Decoupled Visibility Controls**: Residents independently toggle **"Share with the residency"** and **"Show how you come across"**.

### 3. 🌐 3D Spherical Cohort Graph
* Projective 3D geometry arranges residents and shared approach nodes across a spherical shell.
* Nodes grow organically based on verified connections, complementary approaches, and mutual offers.
* High-performance canvas and WebGL rendering with smooth touch and drag navigation.

### 4. 🤝 Grounded Peer Connection & Shared Cognition
* Discovers high-affinity matches across the residency based on four criteria:
  * `shared_problem`
  * `complementary_approach`
  * `shared_exploration`
  * `potential_contribution`
* Cites exact textual evidence from both residents and generates low-friction, casual icebreakers.
* **Shared Cognition Engine**: Granular consent controls, shared journal tabs, and privacy-first mediation.

### 5. 🤖 Grounded Companion Agent
* A dedicated 1-on-1 dialogue partner with longitudinal memory of the resident's intent, open questions, and recent journal moments.
* Cross-pollinates insights with nearby Dhun cohort members.
* Auto-captures key breakthroughs into the resident's memory stream.

### 6. 📊 Acoustic & Emotion Analysis (Hume AI + Deepgram)
* Multi-modal prosody measurement analyzing 48+ emotional dimensions.
* Dynamic pitch, pause, and pace telemetry correlated with user cognitive reflections.

---

## 🚀 Quickstart

### Prerequisites
* **Node.js**: `v20+` or `v22+`
* **Package Manager**: `pnpm` (`v10+` or `v11+`)

### 1. Installation
Clone the repository and install dependencies across the monorepo:

```bash
git clone https://github.com/rohitmodi970/field-station-residency.git
cd field-station-residency
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `apps/web/.env.local`:

```bash
cp .env.example apps/web/.env.local
```

Fill in your API keys (none are committed to git):
* `ANTHROPIC_API_KEY`: Anthropic API key for Claude inference.
* `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase database connection.
* `SUPABASE_SERVICE_ROLE_KEY`: Admin key for server-side persistence.
* `DEEPGRAM_API_KEY`: Audio transcription key (Deepgram Nova-2).

### 3. Run Development Servers

**Run the Next.js Web App:**
```bash
pnpm dev:web
# Accessible at http://localhost:3000
```

**Run the Expo Mobile App:**
```bash
pnpm dev:mobile
# Opens Expo CLI dev menu for iOS simulator, Android emulator, or Expo Go
```

---

## 🛠️ Monorepo Scripts

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Starts the web application in development mode |
| `pnpm dev:web` | Starts Next.js web application (`apps/web`) |
| `pnpm dev:mobile` | Starts Expo dev server for React Native (`apps/residency-campaign`) |
| `pnpm build` | Builds the Next.js web application for production |
| `pnpm typecheck` | Runs `tsc --noEmit` across the codebase |
| `pnpm lint` | Runs ESLint across all apps in the workspace |

---

## 📖 Documentation & Guides

* **[Porting to React Native](docs/PORTING.md)**: Details how web Canvas, WebGL ripples, and DOM components map directly to `@shopify/react-native-skia` and `react-native-reanimated`.
* **[API Specification](docs/API_SPECIFICATION.md)**: Full endpoint definitions, request/response formats, and schemas.
* **[Onboarding & Cohort Architecture](docs/ONBOARDING_ARCHITECTURE.md)**: Comprehensive guide to the multi-modal synthesis pipeline.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Developed with ❤️ by **Rohit Modi** ([@rohitmodi970](https://github.com/rohitmodi970)).
