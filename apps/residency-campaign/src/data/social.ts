import type { Art } from './mira';

export interface Quest {
  id: string;
  name: string;
  theme: string;
  art: Art;
  line: string;
  next: string;
  noticed: string;
}

export interface Person {
  id: string;
  name: string;
  art: Art;
  face?: { art: Art; x: number; y: number };
  energy?: number;
  age?: number;
  where?: string;
  km?: number;
  story?: string;
  differs?: string;
  words?: string;
  shares?: string;
  together?: string;
  quests?: { name: string; art: Art }[];
  reply?: string;
}

export const QUESTS: Quest[] = [
  {
    id: "q-workshop",
    name: "Making things with your hands",
    theme: "workshop",
    art: "park",
    line: "Handcraft and physical tinkering.",
    next: "Spend two hours building without screens",
    noticed: "Every one of your lightest days has your hands busy in it.",
  },
  {
    id: "q-runs",
    name: "Quiet movement and clarity",
    theme: "running",
    art: "water",
    line: "Long slow walks or runs where your head goes quiet.",
    next: "A slow walk this Sunday morning",
    noticed: "After moving outside you write shorter, lighter sentences.",
  },
  {
    id: "q-field",
    name: "Direct operator conversations",
    theme: "field",
    art: "meadow",
    line: "Talking to people at the ground level.",
    next: "One unstructured user conversation this week",
    noticed: "You learn by talking to people, not reading market reports.",
  },
];
