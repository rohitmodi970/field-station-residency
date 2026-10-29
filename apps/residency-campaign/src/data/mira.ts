export type Art = 'hills' | 'park' | 'meadow' | 'water' | 'dusk';

export const ART_COVERS: Record<Art, any> = {
  hills: require('../../assets/images/art/hills.jpg'),
  park: require('../../assets/images/art/park.jpg'),
  meadow: require('../../assets/images/art/meadow.jpg'),
  water: require('../../assets/images/art/water.jpg'),
  dusk: require('../../assets/images/art/ground-3.jpg'),
};

export const GRAIN_ASSET = require('../../assets/images/art/grain.png');

export const ART_TONE: Record<Art, { tint: string; main: string; deep: string }> = {
  hills: { tint: '#fdf1e3', main: '#f2b26e', deep: '#8f5317' },
  park: { tint: '#fcebee', main: '#eb96a8', deep: '#973449' },
  meadow: { tint: '#e9f3e7', main: '#8dc08b', deep: '#3b6a39' },
  water: { tint: '#e5f0fb', main: '#76ade2', deep: '#245a8f' },
  dusk: { tint: '#efecfb', main: '#a596e2', deep: '#4d3e97' },
};

export interface Clip {
  id: string;
  name: string;
  secs: number;
  duration?: number;
  transcript: string;
  src?: string;
}

export const SAMPLE_ANSWERS = [
  "Building a decentralized grid controller for solar microgrids.",
  "Talking directly to factory operators and hardware technicians.",
  "Finding two co-conspirators who understand distributed grid dynamics.",
];
