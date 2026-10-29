# Porting the residency build to React Native

This prototype is a web app (Next.js, DOM, canvas, WebGL). It can't be dropped into React Native as is, but most of it isn't UI. This is what carries over unchanged, what needs one small swap, and what each web-only piece becomes in React Native.

## Copy as is (plain TypeScript, no browser APIs)

| File | What it is |
| --- | --- |
| `data/residency.ts` | Questions, residents, the persona read (`pointsFrom`), the node map (`worldFor`), what's found online (`foundFor`), link handles (`pretty`). Replace the mock parts with the agent's output. |
| `data/social.ts` | People and side-quest types. |
| `lib/f/world.ts` | The pattern map's geometry: node layout on the sphere, camera projection, depth bands, growth timing. Only the drawing changes. |
| `lib/f/analyse.ts`, `lib/f/companion.ts` | Voice and pattern reads, Force's replies. |

## Copy with one swap

| File | Swap |
| --- | --- |
| `lib/f/residency.ts` | The `localStorage` calls become zustand `persist` with MMKV or AsyncStorage. Drop the `?keep=1` URL check. |
| `lib/f/store.ts` | The same `localStorage` swap for `force.onboarded`. zustand works in React Native unchanged. |
| `data/mira.ts` | `entryText` uses a DOM element to strip HTML; use a regex or `htmlparser2`. |

## Web piece → React Native

| Web (file) | React Native |
| --- | --- |
| Canvas 2D goo: `components/r/PatternWorld.tsx`, `components/f/Goo.tsx`, `components/f/Graph3D.tsx` | `@shopify/react-native-skia`. Draw the beads as circles in a `Group` with a blur plus a `ColorMatrix` alpha threshold (the "goo" filter), and paint the painting through it with `ImageShader`. The positions come from `lib/f/world.ts` (`layout`, `project`, `bandOf`). |
| Oil-pastel mark: `components/f/PaintedMark.tsx` | Skia `Path` and `ImageShader` dabs, the same algorithm. Or ship it as a Lottie or video, since it's the same every time. |
| Glass bubbles: `components/f/Glass.tsx` + `.glass` CSS | Skia: a circle-clipped `Image`, two `RadialGradient`s (highlight, edge shade) and a `SweepGradient` ring (the oil-slick rim). |
| Water ripple: `lib/f/ripple.ts` (WebGL) + `components/f/VoiceMode.tsx` (DOM snapshot) | Skia `RuntimeEffect`. The GLSL in `ripple.ts` ports almost line for line to SkSL, run over `makeImageFromView(ref)`. The plain-rings fallback (`.vm-ring`) is a Reanimated scale/opacity loop. Keep the snapshot in sRGB; a linear or wrong-gamma texture is what makes it look washed out. |
| Recording: `lib/f/audio.ts` (getUserMedia, MediaRecorder, AudioContext) | `expo-audio` (`useAudioRecorder` with metering on for the live level). |
| Transcripts (browser SpeechRecognition) | `expo-speech-recognition`, or transcribe on the server. |
| Playback: `lib/f/player.ts` | `expo-audio` player. |
| `haptic()` in `components/f/ui.tsx` (`navigator.vibrate`, Android only on the web) | `expo-haptics`, which works on iOS and Android. |
| Motion (`motion/react` springs, layout animations) | `react-native-reanimated`. The springs in `ui.tsx` (`SPRING`) are duration and bounce; use `withSpring` with `duration` and `dampingRatio` ≈ 1 − bounce. |
| Drags, swipes, taps (pointer events, motion `drag`) | `react-native-gesture-handler` (`Pan`, `Tap`, `LongPress`) with Reanimated. |
| Tailwind classes, `styles/tokens.css` | NativeWind v4 keeps most class names. Otherwise copy the tokens (colours, radii, the type scale in `app/globals.css`) into a theme file. |
| SVG marks: `components/f/brands.tsx`, `Logo` | `react-native-svg`, same paths. |
| Paste button (`navigator.clipboard`) | `expo-clipboard`. |
| Paintings in `public/art` | Bundled image assets. |

## Order that gets something testable fastest

1. Data and store: copy the plain modules and swap storage.
2. Connect and the three questions as a plain chat, with `expo-audio` recording.
3. The pattern map in Skia, from `lib/f/world.ts`.
4. Your page (patterns with swipe, links, found online), then home (People / Conversations).
5. Glass, the ripple and the painted mark last. They're polish, and none of the flow depends on them.
