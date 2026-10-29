# Force · prototype

A web prototype of the Force iOS app, built to be opened on a phone and added to the Home Screen.
Live build: https://force-proto.vercel.app

**Force in one line:** a companion that builds your longitudinal memory and helps you find your perfect side quest partnerships.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Open it on a phone (same network, or a tunnel) and use Share → Add to Home Screen; it runs standalone without Safari chrome.
On a desktop browser it renders inside an iPhone frame.

| URL flag | What it does |
| --- | --- |
| `/?onboard=1` | Replays the onboarding (it otherwise runs once; the flag lives in `localStorage` as `force.onboarded`). |
| `/?demo=new` | Starts with an empty memory, as a first-time person would see it. Default is the Mira persona. |

Checks, all of which must pass before a deploy:

```bash
npx tsc --noEmit     # types
npm run lint         # eslint
npm run check:words  # banned vocabulary in copy (see package.json)
npm run build
```

Deploy (needs access to the Vercel project): `vercel deploy --prod --yes --name force-proto`.

## Residency build (`/residency`, this branch)

Built to the **Intent & Social Graph Architecture v1.1** (28 Oct 2026). Live: https://force-proto.vercel.app/residency. Progress is saved on the phone and survives a refresh; `?reset=1` starts over.

1. **Mark** paints itself, then moves on by itself (`components/r/Onboarding.tsx`).
2. **Connect:** name, optional links (shown on your card to people you connect with, never read), and **Onairos**, which first says what it reads, what Force keeps and why (`components/r/Links.tsx`). If Onairos fails there's a retry and you can carry on without it.
3. **Three questions** in the final v1.1 wording, as a chat. Talk (tap the glass orb) or type. If a browser can't transcribe a recording, Force keeps the audio and asks for a typed line. It never fills in words.
4. **Two optional contribution fields:** "I can help others with…" / "I would value help with…", as quick tags plus a few words of your own.
5. **Intent Snapshot** is drafted (`POST …/intent/synthesize`) and grows in the chat as your map. If synthesis fails: "Try again" or "Use a plain draft from my answers".
6. **"Here's what Force understands so far"** (`components/r/Persona.tsx`): the five fields (Intent, Problem, Approach, Current frontier, Contribution), each with its source. Unknown fields say so and ask you to add them. Swipe right = right, swipe left = fix it, tap = rewrite. Below that: **one** next step with why it may help (accept / edit / dismiss; with too little context it asks you to choose one), what Onairos added (summary, strengths in words, coverage disclosure, "Sample data" label while it's the fixture), and **two separate choices: approve, and share with the residency** (off by default). Any edit after approval needs approving again.
7. **Home** (`components/r/Residents.tsx`): **People** is the cohort graph: approved and shared snapshots only, three node types, structural edges, and resident connections. Below it are your connections, each with type, why, and Reviewed vs Suggested by Force. Zero connections is shown honestly. **Connection detail** (`components/r/Connection.tsx`) gives the type, why (8–20 words), something to explore together, and evidence quotes from both snapshots. Messaging opens the thread with that reason and question. **Conversations** lists Force first, then residents. Side quests are a preview, "coming after the residency".

### The contract, and where the backend plugs in

- **`contract/residency.ts`** is the single source of the data shapes: `Snapshot`, `NextStep`, provenance, `Graph` (node types `person` / `intent_problem` / `theme_approach`; structural edges `person_has_intent` / `intent_has_theme`; connections `shared_problem` / `complementary_approach` / `shared_exploration` / `potential_contribution`), plus:
  - `normalizeOnairos()`: reads the General persona in both standard (`trait → number`) and evidence (`trait → {score, emoji, evidence}`) modes. It keeps the minimum and never the raw payload. `traits_to_improve` stays private.
  - `synthesize()`: a fixture-grade, extractive synthesizer. It keeps the resident's own words and marks inferred approaches. Onairos traits can support a theme but never add one. Replace it with the real model behind the same input and output.
  - `projectGraph()`: only `approved && shared` snapshots, and only connections grounded in both visible snapshots with an 8–20 word reason.
  - `suggestConnections()`: automated candidates from problem, frontier, offer/need and approach. Never from Onairos alone. At most three.
- **`contract/fixtures/`** holds `onairos-general.json` (an evidence-mode sample) and `cohort.json` (five approved residents, one unapproved, and manually reviewed connections marked `reviewed_by`). Arjun's connection is there to prove that unapproved residents are filtered out.
- **`lib/r/api.ts`** has one function per endpoint: `synthesize`, `approve`, `graph`, `connectionWith`, `onairos`. Set `NEXT_PUBLIC_RESIDENCY_API=https://…` and they call `POST /api/residency/intent/synthesize`, `POST …/intent/approve`, `GET …/graph`, `GET …/graph/connection?resident=`. Without it, everything runs locally on the fixtures (fallback rung 3). Wiring the real Onairos means passing `<OnairosButton onComplete={(raw) => r.connectOnairos(raw)} />`.
- **The model behind it** (`server/claude.ts`, kept out of `lib/` so no client bundle can import it), in Force's voice: someone who reads between the lines, never treats you as needing help, and pushes you while keeping your ambition intact.
  - `POST /api/residency/intent/synthesize` uses Claude (`claude-opus-5-5`, structured output) to write the five fields cleanly. It fixes typos and mishearings, and leaves a field null rather than guessing. It also writes two-to-four-word node titles, "What Force noticed" (insights with sources) and Force's take on each part (shown when you tap a node).
  - `POST /api/residency/connections` has Claude compare your approved, shared snapshot with the others' and return at most three connections with evidence (zero is fine). Every result is checked against the 8–20 word rule.
  - `POST /api/residency/footprint`: only when the resident turns on "Let Force look you up" (off by default). Claude reads public pages from their links plus a search of their name (web search and fetch tools) and returns 3–6 findings, each with its sources. The resident can remove any of them. The kept findings feed synthesis and "What Force noticed"; they never go into the graph. Private details are excluded by instruction. Reading starts on Continue and runs while they answer; synthesis waits for it for up to 30s.
  - Connections now include an `opener`: a first message Force drafts. It's shown under "Say hi" on a resident's page for the resident to edit and send.
  - Voice: each recorded answer's measured length, pace and pauses go to synthesis. Force mentions only a clear difference, sourced like "Voice: answer 3". Recordings can be replayed under "Your answers" for the current visit.
  - `POST /api/transcribe` uses ElevenLabs Scribe for voice answers. Browsers without speech recognition (Dia, Arc, Firefox) need it. Sound tags like "(beeping)" are stripped, and an empty transcript makes Force ask for a typed line.
  - Keys go in `ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY`: `.env.local` locally (gitignored) and Vercel project env vars in production. Never `NEXT_PUBLIC_`. With no key, synthesis falls back to the plain extractive draft and connections to the rule-based ones.
- Failure rehearsal: `?onairos=fail`, `?synth=fail`.
- Still for the backend: Supabase tables and **RLS policies that actually enforce** "approved + shared only" (the client filters too, but that's not an access policy), real synthesis, and Shriyanshi's reviewed connections for the real residents in the same `Connection` shape.

Cross-browser check: with the app running, `npm run test:browsers` walks the whole residency flow in WebKit (iPhone Safari's engine), Chromium (Android) and Firefox, and fails on any missing step or page error. It needs Playwright's browsers once: `npx playwright install webkit chromium firefox`.

Building it in React Native: see **[PORTING.md](PORTING.md)**: which files copy over unchanged, and what each web-only piece becomes (Skia, Reanimated, expo-audio, expo-haptics).

Browsers: recording uses `MediaRecorder` (mp4 on Safari, webm on Chrome/Android) and falls back to a labelled sample without a mic; transcripts use the browser's speech recognition where it exists (not Firefox). The ripple needs WebGL and a DOM snapshot; where either fails it falls back to plain rings from the orb.

## What's in it

```
app/
  layout.tsx        metadata: share card, icons, manifest, theme colour
  page.tsx          mounts the app; exposes window.__f (store actions) in dev
  globals.css       type scale, bars, surfaces, pills
styles/tokens.css   colour, depth, radius and motion tokens (the whole palette lives here)
data/
  mira.ts           the Mira persona: entries (moments), themes, clips, patterns, paintings
  social.ts         side quests, the people on the energy map, what they disclose and when
lib/f/
  store.ts          zustand store: chat, memory, side quests, energy map, threads, settings
  companion.ts      what Force says back (scripted, see "Real vs simulated")
  analyse.ts        pattern map + voice read over a set of moments
  audio.ts          mic recording (real), level metering, clip from file
  player.ts         one app-wide audio player
  ripple.ts         WebGL ripple shader used by voice mode
components/f/
  App.tsx           page stack, swipe-back, toasts, onboarding gate
  Companion.tsx     home: the conversation with Force
  Composer.tsx      the field: + menu, text, hold-to-talk mic
  Bubbles.tsx       message bubbles, audio bubble, pull-sideways gesture
  VoiceMode.tsx     hold anywhere → the screen becomes water (snapshot + ripple shader)
  Memory.tsx        memory: the world, filters, search, side quests, maps, moments
  Graph3D.tsx       the world: a 3D canvas of moments strung by theme, painted goo
  EntryView.tsx     a moment: rich text, media blocks, bottom add bar, autosave
  Quests.tsx        a side quest page; shared row components; `useMyForce`
  Energy.tsx        energy map: conversations, painted covers, dive page, map, threads with polls
  Sheet.tsx         the pattern map sheet (mini map, patterns, voice, next moves)
  Onboarding.tsx    number → code → permissions → connections → three voice questions → tour
  PaintedMark.tsx   the mark painted in oil pastel (splash)
  Profile.tsx       you: counts, what Force can use / read, replay, start over
  Nav.tsx, Face.tsx, Goo.tsx, Calendar.tsx, marks.tsx, ui.tsx   shared pieces
public/
  art/              the oil pastel paintings (one per theme) used everywhere colour appears
  icons/            earlier painted icons (unused in the light version, kept for later)
  og.png, icon-*.png, apple-touch-icon.png, manifest.webmanifest
```

## How it fits together

- **Home is the conversation.** Force greets, offers a few replies, and everything you say is kept as a *moment* on the side quest it belongs to. There is nothing to save. Hold anywhere on the conversation to talk (voice mode); hold or pull a message sideways to open its pattern map.
- **Memory (left pill, or swipe right).** The world first (every moment as a drop in its theme's painting, strung to the ones it shares a theme with), filters and search above it, then side quests, pattern maps you've made, and every moment. Tap a drop to see it; Select to pick several; Pattern map runs on whatever is in hand.
- **Energy map (right pill).** Conversations at the top, then "Your energy lately" as painted covers (tap one to dive into the painting: a side quest for that energy and who shares it), then the map: you, with a strand to each person; shorter strand, nearer energy. Before both say yes, only a first name and the shared side quest are shown. Threads are a group of three: you, them and Force, who posts polls.
- **Pattern map** is the only analysis. If there's voice in what it's reading, what your voice did appears inside the same map. Next moves can be kept (nudge) or let go by swiping.
- **Onboarding** ends with three questions answered out loud; those answers become the first moments, and the world grows from them in front of you.

## Real vs simulated

| Real | Simulated (and where) |
| --- | --- |
| Recording from the mic, level metering, playback | Force's replies: scripted on keywords and the persona's past (`lib/f/companion.ts`) |
| All gestures, pages, sheets, voice-mode ripple | Pattern maps: counted from the persona's data, not a model (`lib/f/analyse.ts`, `data/mira.ts`) |
| Entry editing, formatting, media blocks, autosave (in memory for the session) | Speech-to-text: real recordings have no transcript yet |
| Browser permission prompts (mic, notifications, location) | People, matching, "they said yes", their replies (`data/social.ts`, `store.ts`) |
| Onboarding flow, `localStorage` flag | Phone number / code: any six digits pass; no SMS |
| | Calendar / Photos / Notes connections: a timer, no API |
| | Nudges: kept moves are stored, nothing is scheduled |

Nothing persists between reloads except the onboarded flag. There is no backend.

## Design rules the code follows

- Type: 26 / 20 / 16 / 15 / 13 / 12 (body is 15), the phone's own font; Syne Mono for dates only. At most three sizes per screen.
- 8pt grid, 16pt side margins, 44pt minimum tap targets, 52pt main pills.
- Warm greys (`styles/tokens.css`), near-black ink, one accent (blue, state only), soft shadows, no borders.
- Colour comes from the paintings (`public/art`, `ART_SRC` / `ART_TONE` in `data/mira.ts`), never from generated gradients.
- Motion only where something physically moves: sheets, pages growing from their pill, drags, the ripple. Content appears, it doesn't animate in.
- Chat language everywhere: bubbles, white pills, the composer shape. New flows are built from these parts.

## Known limits of a web build

These need a native wrapper (Capacitor is the quickest route) rather than more web work:
- The ↑ ↓ Done bar above the iOS keyboard is Safari's and cannot be removed.
- Haptics: `navigator.vibrate` works on Android only.
- Notifications / nudges, background audio, Contacts, Calendar and Photos access.
- Voice mode photographs the screen once when you hold; it can't follow a screen that changes while you talk.
