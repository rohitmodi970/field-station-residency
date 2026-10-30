# Field Station Residency

> **This is the prototype of social intelligence on top of longitudinal memory that we’re building on our existing platform at [www.findmyforce.com](https://www.findmyforce.com).**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-findmyforce.com-black)](https://www.findmyforce.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black)](https://nextjs.org/)
[![Expo](https://img.shields.io/badge/Expo-~54.0-blue)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.81.5-61dafb)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8)](https://tailwindcss.com/)

---

## 👥 The Team

| Member | Role | Profile |
| :--- | :--- | :--- |
| **[Shriyanshi Shikha](https://www.linkedin.com/in/shriyanshi21/)** | Team Lead & Founder | [LinkedIn](https://www.linkedin.com/in/shriyanshi21/) |
| **[Srinjoy Sen Chowdhury](https://www.linkedin.com/in/srinjoy-sen-chowdhury-90959a249/)** | AI Engineer | [LinkedIn](https://www.linkedin.com/in/srinjoy-sen-chowdhury-90959a249/) |
| **[Arushi Upmanyu](https://www.linkedin.com/in/arushiupmanyu/)** | Product & Design | [LinkedIn](https://www.linkedin.com/in/arushiupmanyu/) |
| **[Rohit Kumar Modi](https://www.linkedin.com/in/rohitmodi970/)** | Full Stack Developer | [LinkedIn](https://www.linkedin.com/in/rohitmodi970/) |

---

## 💡 What is Field Station Residency?

Traditional cohort networking is broken: people fill out tedious intake forms or static profiles that get instantly forgotten. Valuable collaborative breakthroughs are missed because residents don't know who is exploring complementary problems or facing identical friction.

**Field Station Residency** solves this by introducing **social intelligence built directly on top of longitudinal memory**:

1. **Speak Naturally, Zero Bureaucracy**: Instead of filling forms, residents join by answering 3 natural conversational questions via voice or text.
2. **Intent Synthesis ("The Four Parts")**: Real-time Claude 3.5 synthesis transforms open thoughts into 4 living, structured foundational dimensions:
   - **Background**: Where you're coming from and your context.
   - **Project**: What you are focused on building or exploring right now.
   - **Obstacle**: The key friction or challenge you are navigating.
   - **Approach**: How you're tackling it (and what you're still figuring out).
3. **Tactile Resident Agency ("That's Me / Not Me")**: The resident always has the final word. Every synthesized trait can be swiped right to confirm or swiped left to refine in their own words. Your words always win.
4. **Behavioral Archetypes via Onairos (`v8.12.4`)**: Ingests connected media and developer accounts (YouTube, Claude, Spotify) to surface cognitive strengths and working archetypes, protected by independent privacy toggles.
5. **Living 3D Spherical Cohort Graph**: Renders the resident cohort in an interactive 3D universe, dynamically organizing members by shared inquiries and complementary frontiers.
6. **Grounded Peer Matchmaking**: Detects high-resonance connections across the cohort, citing exact textual evidence from both residents and providing tailored, low-friction icebreakers.
7. **Intelligent Companion Agent**: A conversational companion with longitudinal memory that remembers your open questions, captures breakthrough reflections, and surfaces serendipitous cohort connections over time.

---

## 🏛️ Monorepo Architecture

This repository is organized as a unified monorepo containing both the full Next.js web platform and the native Expo mobile campaign:

```text
field-station-residency/
├── apps/
│   ├── web/                             # Next.js 16 Web Application
│   │   ├── app/                         # App Router
│   │   │   ├── field-station-residency/ # Main residency experience & graph view
│   │   │   ├── (onboarding)/            # Audio-first onboarding flows
│   │   │   ├── connect/                 # Onairos & platform connector hub
│   │   │   ├── residency/               # Living UI & cohort graph view
│   │   │   └── api/residency/           # Server APIs (analyze, synthesize, connections)
│   │   │
│   │   ├── components/
│   │   │   ├── r/                       # Residency UI (Persona, Traits, Links, PatternWorld)
│   │   │   ├── f/                       # Living UI primitives (Glass, Bubbles, Frame, Marks)
│   │   │   ├── onBoarding/              # Onboarding v2 flow, OnairosSdkConnector
│   │   │   ├── companion/               # Proactive companion cards & dialogue view
│   │   │   ├── shared-cognition/        # Consent mediation & connections panel
│   │   │   ├── voiceAnalysis/           # Audio waveforms & speech telemetry
│   │   │   └── layout/                  # Responsive shells & navigation
│   │   │
│   │   ├── contract/                    # Type definitions, v1.1 residency schemas, fixtures
│   │   ├── lib/                         # Residency store, cohort graph algorithms, Onairos adapter
│   │   ├── server/claude.ts             # Claude inference engine (deterministic synthesis)
│   │   └── styles/                      # Token system & residency aesthetic styling
│   │
│   └── residency-campaign/              # Expo / React Native Mobile Application
│       ├── app/                         # Expo Router file-based screens
│       ├── src/components/f/            # Skia canvas, Living UI marks, and bubbles
│       ├── src/components/r/            # Native swipe cards ("That's me / Not me"), persona views
│       ├── src/stores/                  # Zustand persistent state with MMKV / AsyncStorage
│       └── src/lib/                     # Spherical projection math & API client
│
├── docs/                                # Technical & Architectural Specifications
│   ├── PORTING.md                       # Guide for porting web primitives to React Native / Skia
│   ├── API_SPECIFICATION.md             # Residency API contracts & endpoint reference
│   └── ONBOARDING_ARCHITECTURE.md       # Intent synthesis & graph projection pipeline
│
├── .env.example                         # Environment variable template (zero secrets committed)
├── pnpm-workspace.yaml                  # Workspace package configuration
└── LICENSE                              # MIT License
```

---

## 🌟 Key Features

### 1. 🎙️ 3-Question Conversational Onboarding
Residents join by answering three focused, thought-provoking questions:
1. *What are you working toward right now, and why does it matter to you?*
2. *What problem, question, or opportunity are you focused on?*
3. *How are you approaching it so far and what are you still trying to figure out?*

Real-time audio processing captures reflections naturally, preserving the resident's authentic voice.

### 2. 🧩 Behavioral Archetypes via Onairos (`v8.12.4`)
* Connects securely to the resident's platforms (YouTube, Claude, Spotify, GitHub) to map cognitive strengths, archetypes, and working affinities.
* **"How you come across" UI**: Archetype tiles, narrative explanations, and transparent data coverage indicators.
* **Granular Privacy Controls**: Residents independently toggle **"Share with the residency"** and **"Show how you come across"**. Nothing is shared without permission.

### 3. 🌐 3D Spherical Cohort Graph
* Projective 3D geometry places residents and shared inquiry nodes across an organic spherical universe.
* Nodes grow and cluster organically based on verified connections, complementary approaches, and mutual frontiers.
* High-performance Canvas and WebGL rendering with smooth pan, zoom, and drag gestures.

### 4. 🤝 Grounded Peer Connection Discovery
* Discovers high-affinity matches across the residency based on four grounded criteria:
  * `shared_problem`: Tackling similar friction or domains.
  * `complementary_approach`: Different skills that complete each other.
  * `shared_exploration`: Asking the same foundational questions.
  * `potential_contribution`: One resident offers what the other needs.
* Cites exact textual statements from both residents and suggests natural, low-pressure conversation starters.

### 5. 🤖 Companion with Longitudinal Memory
* A 1-on-1 dialogue partner with persistent memory of the resident's evolving project, open questions, and recent breakthroughs.
* Connects your ideas with fellow residents in the background, surfacing relevant peers when you hit an obstacle.

---

## 🚀 Quickstart

### Prerequisites
* **Node.js**: `v20+` or `v22+`
* **Package Manager**: `pnpm` (`v10+` or `v11+`)

### 1. Clone & Install
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
* `ANTHROPIC_API_KEY`: Anthropic Claude API key for intent synthesis.
* `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase database credentials.
* `NEXT_PUBLIC_ONAIROS_API_KEY`: Onairos developer API key for behavioral connect.

### 3. Run Development Servers

**Web Application (Next.js):**
```bash
pnpm dev:web
# Open http://localhost:3000/field-station-residency
```

**Mobile Application (Expo / React Native):**
```bash
pnpm dev:mobile
# Opens Expo CLI dev menu for iOS Simulator, Android Emulator, or Expo Go
```

---

## 🛠️ Monorepo Scripts

| Command | Action |
| :--- | :--- |
| `pnpm dev` | Starts the web application in development mode |
| `pnpm dev:web` | Starts Next.js web application (`apps/web`) |
| `pnpm dev:mobile` | Starts Expo dev server for React Native (`apps/residency-campaign`) |
| `pnpm build` | Builds the web application for production |
| `pnpm typecheck` | Runs `tsc --noEmit` across the codebase |
| `pnpm lint` | Runs ESLint across all apps in the workspace |

---

## 📖 Documentation

* **[Porting to React Native](docs/PORTING.md)**: Web Canvas & SVG to `@shopify/react-native-skia` and `react-native-reanimated`.
* **[API Specification](docs/API_SPECIFICATION.md)**: v1.1 residency schema and endpoint reference.
* **[Onboarding & Cohort Architecture](docs/ONBOARDING_ARCHITECTURE.md)**: Comprehensive guide to the multi-modal synthesis pipeline.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Developed with ❤️ by the **Force** Team for **Field Station Residency**.
