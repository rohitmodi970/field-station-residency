// Side quests, and the people whose energy matches them.
//
// A side quest is something Mira keeps coming back to because it makes her life hers: the
// workshop, the Sunday runs, staying close to Aai. Force builds them from what she tells it;
// she never files anything. Each one carries its next small move.
//
// Energy mapping: people (and a group) on the same side quest, with the same energy lately.
// Before anyone says yes, all you see is a first name and the side quest you share. Reach
// out, and they get asked; once they accept, the rest is disclosed and you can talk.

import type { Art } from "./mira";
import { RESIDENTS } from "./residency";

export interface Quest {
  id: string;
  name: string;
  theme: string; // the memory theme it grows from
  art: Art;
  line: string; // what it is, in her words
  next: string; // the next small move
  noticed: string; // one crisp thing Force has noticed, never a verdict
}

export const QUESTS: Quest[] = [
  {
    id: "q-workshop",
    name: "Making things at Dev's table",
    theme: "workshop",
    art: "park",
    line: "Saturdays downstairs. He planes walnut, I sketch nothing in particular.",
    next: "Two hours at the table this Saturday, phone in the other room",
    noticed: "Every one of your lightest days has your hands busy in it.",
  },
  {
    id: "q-runs",
    name: "Sunday runs at Sankey",
    theme: "running",
    art: "water",
    line: "Somewhere after 7k my head goes quiet.",
    next: "A slow 5k this Sunday, no watch",
    noticed: "After a long run you write shorter, lighter sentences.",
  },
  {
    id: "q-aai",
    name: "Staying close to Aai",
    theme: "aai",
    art: "meadow",
    line: "Three hours away is not far. It's just never this week.",
    next: "Call Aai on your Sunday run",
    noticed: "You talk more with her walking than sitting down.",
  },
  {
    id: "q-work",
    name: "Work that leaves room",
    theme: "ambition",
    art: "hills",
    line: "Ambition that leaves room for a life.",
    next: "Ask Arjun what the role looks like on a Friday",
    noticed: "When you picture a good day, it's a table, not a launch.",
  },
];

// A side quest Force thinks she's circling but hasn't named.
export const MAYBE_QUEST = {
  name: "Build your own chair",
  why: "You've said “I want to make something with my own hands” four times since February.",
  art: "park" as Art,
};

// A face: a crop of one of the oil pastel paintings, until her own portraits arrive.
export interface Face {
  art: Art;
  x: number; // background position, %
  y: number;
  img?: string; // a real picture, when there is one
}

export const MIRA_FACE: Face = { art: "dusk", x: 48, y: 30 };

export interface Person {
  id: string;
  name: string;
  face: Face;
  shares: string; // the side quest you have in common
  energy: number; // 0..1, how close their energy is to yours lately
  group?: number; // a group of this many, not one person
  // Disclosed only after they accept
  age: number;
  where: string;
  km: number; // how far from you
  together: string; // what Force suggests you two do, once you're connected
  quests: { name: string; art: Art }[];
  story: string; // why it's the same story
  differs: string; // where they went differently
  words: string; // a line of theirs
  reply: string; // their first message once you're connected
}

export const PEOPLE: Person[] = [
  {
    id: "kavya",
    name: "Kavya",
    face: { art: "park", x: 20, y: 70 },
    shares: "q-workshop",
    energy: 0.92,
    age: 29,
    where: "Indiranagar",
    km: 4,
    together: "You both keep Saturdays for making things. Kavya's makerspace has a spare bench this Saturday from 10. Go together?",
    quests: [
      { name: "Weekend woodworking at a makerspace", art: "park" },
      { name: "Leaving a big-tech track", art: "hills" },
      { name: "Sleeping before midnight", art: "dusk" },
    ],
    story: "Makes furniture on weekends after a week of building software.",
    differs: "She went down to four days a week to keep it.",
    words: "I stopped asking work to be the meaningful part.",
    reply: "Hi Mira! Force said you sketch while someone else builds. I'm at the makerspace Saturday from 10, there's a spare bench if you want it.",
  },
  {
    id: "sankey",
    name: "Sankey runners",
    face: { art: "water", x: 60, y: 40 },
    shares: "q-runs",
    energy: 0.8,
    group: 8,
    age: 0,
    where: "Sankey Tank, north gate",
    km: 2,
    together: "They run Sankey every Sunday at 6:15, the same loop you do alone. Join this Sunday, coffee after?",
    quests: [{ name: "Sunday runs at Sankey", art: "water" }],
    story: "Eight people who run the same lake you do, on the same mornings.",
    differs: "They run together. You've only ever run alone.",
    words: "Slow pace, coffee after. No pressure at all.",
    reply: "Hey Mira, welcome! We start at the north gate at 6:15 on Sundays. Slow pace, coffee after. Just show up.",
  },
  {
    id: "leah",
    name: "Leah",
    face: { art: "water", x: 85, y: 75 },
    shares: "q-runs",
    energy: 0.74,
    age: 30,
    where: "Malleshwaram",
    km: 1,
    together: "You're a kilometre apart and both run Sankey on Sundays. One loop together this week, slow pace?",
    quests: [
      { name: "Sunday runs at Sankey", art: "water" },
      { name: "Learning to cook her dad's recipes", art: "meadow" },
    ],
    story: "Runs the same lake on Sunday mornings.",
    differs: "She started running to stop thinking. Now she runs to think.",
    words: "Running alone fixed my head. Running with them fixed my weeks.",
    reply: "Hey! I'm usually at Sankey by 6:30 on Sundays. Want to do a loop together this week?",
  },
  {
    id: "ishaan",
    name: "Ishaan",
    face: { art: "meadow", x: 30, y: 20 },
    shares: "q-aai",
    energy: 0.66,
    age: 32,
    where: "Pune",
    km: 840,
    together: "You're far apart, so a call: twenty minutes this week on what moving closer to a parent actually took.",
    quests: [
      { name: "Being near his parents", art: "meadow" },
      { name: "Remote work that works", art: "hills" },
    ],
    story: "Lived three hours from his mother and kept moving the trip.",
    differs: "He moved back to Pune and works remotely.",
    words: "The distance wasn't the problem. Finding out late was.",
    reply: "Hi Mira. Happy to tell you what moving back was actually like, the good and the strange.",
  },
  {
    id: "noor",
    name: "Noor",
    face: { art: "hills", x: 70, y: 60 },
    shares: "q-work",
    energy: 0.58,
    age: 33,
    where: "Mumbai",
    km: 980,
    together: "Noor said no to the same role you're weighing. A thirty-minute call before you answer Arjun?",
    quests: [
      { name: "A studio of three", art: "hills" },
      { name: "Pottery on Thursdays", art: "park" },
    ],
    story: "Was offered head of design and said she'd think about it.",
    differs: "She said no, and started a studio of three.",
    words: "I wanted significant. I'd mixed it up with visible.",
    reply: "Hi! I remember the week I was deciding. Ask me anything, including what I'd do differently.",
  },
  {
    id: "sam",
    name: "Sam",
    face: { art: "dusk", x: 15, y: 85 },
    shares: "q-work",
    energy: 0.5,
    age: 31,
    where: "Koramangala",
    km: 7,
    together: "You both wake at 3 before reviews. Sam's trick is a proud list. Write yours this week and compare them over a walk?",
    quests: [
      { name: "Quieter nights", art: "dusk" },
      { name: "Bouldering twice a week", art: "water" },
      { name: "Fixing old cameras", art: "park" },
    ],
    story: "Wakes at 3 a.m. before every review.",
    differs: "He keeps a list of what he's proud of, and reads it the night before.",
    words: "The fear was never failing. It was being forgettable.",
    reply: "Hey Mira. The 3 a.m. thing, yeah. Want to see my proud list? It's embarrassingly short and it works.",
  },
];

// Someone whose energy map found you: what they see of you before you accept is the same.
export const INCOMING = { id: "sam", quest: "q-work" };

export const questById = (id: string) => QUESTS.find((q) => q.id === id);
export const personById = (id: string): Person | undefined => PEOPLE.find((p) => p.id === id) ?? RESIDENTS.find((p) => p.id === id);
export const questOfTheme = (theme: string) => QUESTS.find((q) => q.theme === theme);
