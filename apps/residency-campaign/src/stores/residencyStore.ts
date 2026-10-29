import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { residencyApi } from '../lib/api';
import {
  LinkKind,
  Point,
  Found,
  foundFor,
  pointsFrom,
  HEADLINE,
  WNode,
  worldFor,
  traitsFromOnairos,
} from '../data/residency';
import type { Clip } from '../data/mira';

const STORAGE_KEY = 'force.residency.mobile.v1';

export interface ResidencyState {
  done: boolean;
  uniqueId: string;
  name: string;
  email: string;
  links: Partial<Record<LinkKind, string>>;
  extra: string[];
  onairos: 'off' | 'busy' | 'on';
  onairosData: any | null;
  answers: string[];
  clips: Clip[];
  points: Point[];
  found: Found[];
  removed: string[];
  agreed: string[];
  fit: 'spot' | 'mostly' | 'no' | null;
  isAnalyzing: boolean;
  aiHeadline: string | null;
  aiIntents: any[] | null;
  aiThemes: any[] | null;
  tab: 'people' | 'conversations';

  // Actions
  initialize: () => Promise<void>;
  setName: (name: string) => void;
  setLink: (k: LinkKind, v: string) => void;
  setExtra: (index: number, v: string) => void;
  addExtra: () => void;
  setOnairosComplete: (data: any, exported?: any) => Promise<void>;
  restoreUserByIdentifier: (opts: { email?: string; uniqueId?: string; token?: string }) => Promise<boolean>;
  read: (answers: string[], clips?: Clip[]) => Promise<void>;
  agree: (id: string) => void;
  editPoint: (id: string, text: string) => void;
  dropPoint: (id: string) => void;
  addPoint: (text: string) => void;
  setFit: (fit: 'spot' | 'mostly' | 'no') => void;
  setTab: (tab: 'people' | 'conversations') => void;
  finish: (tab?: 'people' | 'conversations') => void;
  logout: () => Promise<void>;
  sync: () => Promise<void>;
}

const INITIAL_STATE = {
  done: false,
  uniqueId: '',
  name: '',
  email: '',
  links: {},
  extra: [],
  onairos: 'off' as const,
  onairosData: null,
  answers: [],
  clips: [],
  points: [],
  found: [],
  removed: [],
  agreed: [],
  fit: null,
  isAnalyzing: false,
  aiHeadline: null,
  aiIntents: null,
  aiThemes: null,
  tab: 'people' as const,
};

let syncTimer: any = null;

export const useResidencyStore = create<ResidencyState>((set, get) => ({
  ...INITIAL_STATE,

  async initialize() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        set(parsed);
      }
    } catch (err) {
      console.warn('[ResidencyStore] Failed to restore local state:', err);
    }
  },

  setName(name: string) {
    set({ name });
    get().sync();
  },

  setLink(k: LinkKind, v: string) {
    set((s) => ({ links: { ...s.links, [k]: v } }));
    get().sync();
  },

  setExtra(index: number, v: string) {
    set((s) => ({ extra: s.extra.map((x, j) => (j === index ? v : x)) }));
    get().sync();
  },

  addExtra() {
    set((s) => ({ extra: [...s.extra, ''] }));
  },

  async setOnairosComplete(data: any, exported?: any) {
    const rawEmail =
      data?.email ||
      data?.userEmail ||
      data?.userData?.email ||
      data?.userData?.basic?.email ||
      data?.profile?.email ||
      exported?.profile?.email ||
      exported?.userSummary?.email ||
      '';
    const cleanEmail = typeof rawEmail === 'string' && rawEmail.includes('@') ? rawEmail.trim().toLowerCase() : '';
    const token = data?.token || exported?.token;

    let currentId = get().uniqueId;
    if (!currentId && cleanEmail) {
      const hash = cleanEmail.replace(/[^a-z0-9]/g, '').slice(0, 6).toUpperCase();
      currentId = `RES-${hash}`;
    }

    const payload = exported || data;
    set({
      onairos: 'on',
      onairosData: payload,
      uniqueId: currentId,
      ...(cleanEmail ? { email: cleanEmail } : {}),
    });

    if (cleanEmail) {
      await get().restoreUserByIdentifier({ email: cleanEmail, token });
    }

    // Re-run pattern analysis if answers are already recorded
    const state = get();
    const hasValidAnswers =
      Array.isArray(state.answers) &&
      state.answers.some((a) => typeof a === "string" && a.trim().length > 0);
    if (hasValidAnswers) {
      get().read(state.answers, state.clips);
    }

    get().sync();
  },

  async restoreUserByIdentifier(identifier: { email?: string; uniqueId?: string; token?: string }) {
    const { email, uniqueId, token } = identifier;
    if (!email && !uniqueId) return false;

    try {
      const data = await residencyApi.getParticipant({ email, uniqueId, token });
      const p = data?.participant;

      if (p && (p.done || (Array.isArray(p.answers) && p.answers.length > 0) || p.fit || (Array.isArray(p.persona_points) && p.persona_points.length > 0))) {
        set({
          done: true,
          uniqueId: p.unique_id || get().uniqueId,
          name: p.name || get().name,
          email: p.email || get().email,
          links: p.links || {},
          extra: Array.isArray(p.extra_links) ? p.extra_links : [],
          onairos: p.onairos_status === 'on' ? 'on' : get().onairos,
          onairosData: p.onairos_data || get().onairosData,
          answers: Array.isArray(p.answers) ? p.answers : [],
          points: Array.isArray(p.persona_points) ? p.persona_points : [],
          agreed: Array.isArray(p.agreed_points) ? p.agreed_points : [],
          removed: Array.isArray(p.removed_found) ? p.removed_found : [],
          fit: p.fit || null,
        });
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(get()));
        return true;
      }
    } catch (err) {
      console.warn('[ResidencyStore] Participant recovery notice:', err);
    }
    return false;
  },

  async read(answers: string[], clips: Clip[] = []) {
    const s = get();
    set({
      answers,
      clips,
      points: pointsFrom(answers),
      found: foundFor(s.name, s.links),
      removed: [],
      fit: null,
      agreed: [],
      isAnalyzing: true,
    });
    get().sync();

    try {
      const res = await residencyApi.analyze({
        answers,
        name: get().name || s.name,
        uniqueId: get().uniqueId || s.uniqueId,
        links: get().links || s.links,
        onairosData: get().onairosData || s.onairosData,
      });

      if (res?.analysis) {
        const nextPoints =
          Array.isArray(res.analysis.points) && res.analysis.points.length > 0
            ? res.analysis.points
            : pointsFrom(answers);
        set({
          points: nextPoints,
          aiHeadline: res.analysis.headline || null,
          aiIntents: res.analysis.intents || null,
          aiThemes: res.analysis.themes || null,
          isAnalyzing: false,
        });
        get().sync();
      } else {
        set({ isAnalyzing: false });
      }
    } catch (err) {
      console.warn('[ResidencyStore] LLM analysis fallback notice:', err);
      set({ isAnalyzing: false });
    }
  },

  agree(id: string) {
    set((s) => ({ agreed: s.agreed.includes(id) ? s.agreed : [...s.agreed, id] }));
    get().sync();
  },

  editPoint(id: string, text: string) {
    set((s) => ({ points: s.points.map((p) => (p.id === id ? { ...p, text } : p)) }));
    get().sync();
  },

  dropPoint(id: string) {
    set((s) => ({ points: s.points.filter((p) => p.id !== id) }));
    get().sync();
  },

  addPoint(text: string) {
    if (!text.trim()) return;
    const p: Point = { id: `own-${Date.now()}`, text: text.trim(), why: 'Added by you' };
    set((s) => ({ points: [...s.points, p], agreed: [...s.agreed, p.id] }));
    get().sync();
  },

  setFit(fit: 'spot' | 'mostly' | 'no') {
    set({ fit, done: true });
    get().sync();
  },

  setTab(tab: 'people' | 'conversations') {
    set({ tab });
  },

  finish(tab: 'people' | 'conversations' = 'people') {
    set({ done: true, tab });
    get().sync();
  },

  async logout() {
    if (syncTimer) clearTimeout(syncTimer);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
    set({ ...INITIAL_STATE });
  },

  async sync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      const s = get();
      // 1. Persist locally
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {}

      // 2. Persist to backend
      try {
        const res = await residencyApi.save({
          uniqueId: s.uniqueId,
          name: s.name,
          email: s.email,
          links: s.links as Record<string, string>,
          extraLinks: s.extra,
          onairosStatus: s.onairos,
          onairosData: s.onairosData,
          answers: s.answers,
          audioClips: s.clips,
          personaPoints: s.points,
          agreedPoints: s.agreed,
          removedFound: s.removed,
          fit: s.fit,
        });

        if (res?.uniqueId && res.uniqueId !== s.uniqueId) {
          set({ uniqueId: res.uniqueId });
        }
      } catch (err) {
        console.warn('[ResidencyStore] Background sync notice:', err);
      }
    }, 600);
  },
}));
