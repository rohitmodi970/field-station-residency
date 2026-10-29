'use client';
// apps/web/hooks/useCollabSession.ts
// React hook that manages the WebSocket connection to apps/collab-server.
//
// Responsibilities:
//   - Auth handshake (token → join)
//   - Receive Yjs update blobs and decrypt with journal AES key (from Phase 2 cache)
//   - Encrypt outgoing updates before sending
//   - Relay cursor positions (no encryption — positions are non-sensitive)
//   - Presence list management
//   - Heartbeat ping/pong
//   - Auto-reconnect with exponential backoff (max 5 attempts)
//   - Graceful cleanup on unmount

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { getCachedJournalKey } from '@/utils/encryption/collaborationCrypto';

// ─── Types ────────────────────────────────────────────────────────────────

export interface PresenceUser {
  userId:    string;
  name:      string;
  avatarUrl: string | null;
  color:     string;
  role:      'viewer' | 'editor' | 'owner';
  cursor:    { from: number; to: number } | null;
  lastSeen:  string;
}

export interface CollabSession {
  isConnected:  boolean;
  peers:        PresenceUser[];
  myColor:      string;
  myRole:       'viewer' | 'editor' | 'owner' | null;
  kickReason:   string | null;
  /** Encrypt a Yjs V2 update and send it. No-op for viewers or when disconnected. */
  sendUpdate:   (yjsUpdate: Uint8Array) => Promise<void>;
  /** Send cursor position (all roles including viewers). */
  sendCursor:   (from: number, to: number) => void;
  /** Register a callback to receive decrypted Yjs update blobs from peers. */
  onUpdate:     (cb: UpdateCallback) => () => void;
}

export type UpdateCallback = (update: Uint8Array, userId: string) => void;

const NOOP_SESSION: CollabSession = {
  isConnected:  false,
  peers:        [],
  myColor:      '#94a3b8',
  myRole:       null,
  kickReason:   null,
  sendUpdate:   async () => {},
  sendCursor:   () => {},
  onUpdate:     () => () => {},
};

// ─── AES-GCM helpers (WebCrypto, same key from Phase 2 cache) ─────────────

async function encryptUpdate(key: CryptoKey, data: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data as unknown as BufferSource);
  // Pack: [12-byte IV][ciphertext] → base64
  const packed = new Uint8Array(12 + cipher.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(cipher), 12);
  return btoa(String.fromCharCode(...packed));
}

async function decryptUpdate(key: CryptoKey, base64: string): Promise<Uint8Array> {
  const raw  = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const iv   = raw.slice(0, 12);
  const data = raw.slice(12);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data as unknown as BufferSource);
  return new Uint8Array(plain);
}

// Deterministic color — mirrors the server's getColor()
const COLLAB_COLORS = ['#E57373', '#64B5F6', '#81C784', '#FFD54F', '#BA68C8', '#4DD0E1'];
function getColor(userId: string): string {
  return COLLAB_COLORS[userId.charCodeAt(0) % COLLAB_COLORS.length] || '#E57373';
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useCollabSession(params: {
  journalId:  string;
  enabled:    boolean;
  keyVersion: number;
}): CollabSession {
  const { journalId, enabled, keyVersion } = params;

  const [isConnected, setIsConnected] = useState(false);
  const [peers,       setPeers]       = useState<PresenceUser[]>([]);
  const [myRole,      setMyRole]      = useState<CollabSession['myRole']>(null);
  const [myColor,     setMyColor]     = useState('#94a3b8');
  const [kickReason,  setKickReason]  = useState<string | null>(null);

  const wsRef         = useRef<WebSocket | null>(null);
  const updateCbsRef  = useRef<Set<UpdateCallback>>(new Set());
  const reconnectRef  = useRef(0);     // attempt counter
  const mountedRef    = useRef(true);
  const myUserIdRef   = useRef<string | null>(null);

  // ── Send helper ──────────────────────────────────────────────────────────
  const rawSend = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  // ── sendUpdate ────────────────────────────────────────────────────────────
  const sendUpdate = useCallback(async (yjsUpdate: Uint8Array) => {
    if (!isConnected || myRole === 'viewer' || !myRole) return;
    const aesKey = getCachedJournalKey(journalId);
    if (!aesKey) {
      console.warn('[useCollabSession] No cached journal key — cannot encrypt update');
      return;
    }
    const encrypted = await encryptUpdate(aesKey, yjsUpdate);
    rawSend({ type: 'update', journalId, update: encrypted, keyVersion });
  }, [isConnected, myRole, journalId, keyVersion, rawSend]);

  // ── sendCursor ────────────────────────────────────────────────────────────
  const sendCursor = useCallback((from: number, to: number) => {
    if (!isConnected) return;
    rawSend({ type: 'cursor', journalId, from, to });
  }, [isConnected, journalId, rawSend]);

  // ── onUpdate registration ─────────────────────────────────────────────────
  const onUpdate = useCallback((cb: UpdateCallback): (() => void) => {
    updateCbsRef.current.add(cb);
    return () => updateCbsRef.current.delete(cb);
  }, []);

  // ── Connect ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    mountedRef.current = true;

    let pingInterval: ReturnType<typeof setInterval> | null = null;

    async function connect() {
      const wsUrl = process.env.NEXT_PUBLIC_COLLAB_WS_URL ?? 'ws://localhost:4001';

      // Get Supabase session token
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('[useCollabSession] No session — cannot connect');
        return;
      }
      const userId = session.user.id;
      myUserIdRef.current = userId;
      setMyColor(getColor(userId));

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[useCollabSession] WS open');
        reconnectRef.current = 0;

        // Step 1: auth
        ws.send(JSON.stringify({ type: 'auth', token: session.access_token }));
        // Step 2: join (clientSeq=0 for first connect; TODO: persist last seq in localStorage)
        const lastSeq = parseInt(localStorage.getItem(`collab_seq_${journalId}`) ?? '0', 10);
        ws.send(JSON.stringify({ type: 'join', journalId, clientSeq: lastSeq }));

        // Heartbeat
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, 25_000);
      };

      ws.onmessage = async (event) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(event.data as string); }
        catch { return; }

        switch (msg.type) {
          case 'auth_fail':
            console.error('[useCollabSession] Auth failed:', msg.reason);
            ws.close();
            break;

          case 'joined': {
            setIsConnected(true);
            const joinedPeers = (msg.peers ?? []) as PresenceUser[];
            setPeers(joinedPeers);
            // myRole is in the peers list emitted by server — find it after presence arrives
            break;
          }

          case 'auth_ok':
            setMyRole(msg.role as CollabSession['myRole']);
            break;

          case 'sync': {
            // Catch-up: decrypt and replay each update
            const aesKey = getCachedJournalKey(journalId);
            if (!aesKey) break;
            const updates = msg.updates as string[];
            for (const enc of updates) {
              try {
                const plain = await decryptUpdate(aesKey, enc);
                updateCbsRef.current.forEach(cb => cb(plain, '__sync__'));
              } catch (err) {
                console.warn('[useCollabSession] Failed to decrypt sync op:', err);
              }
            }
            break;
          }

          case 'update': {
            if (msg.userId === myUserIdRef.current) break; // ignore own echoes (shouldn't happen)
            const aesKey = getCachedJournalKey(journalId);
            if (!aesKey) break;
            try {
              const plain = await decryptUpdate(aesKey, msg.update as string);
              updateCbsRef.current.forEach(cb => cb(plain, msg.userId as string));
            } catch (err) {
              console.warn('[useCollabSession] Failed to decrypt peer update:', err);
            }
            break;
          }

          case 'cursor':
            setPeers(prev => prev.map(p =>
              p.userId === msg.userId
                ? { ...p, cursor: { from: msg.from as number, to: msg.to as number } }
                : p
            ));
            break;

          case 'presence':
            setPeers((msg.users as PresenceUser[]).filter(u => u.userId !== myUserIdRef.current));
            // Update myRole from presence list
            const me = (msg.users as PresenceUser[]).find(u => u.userId === myUserIdRef.current);
            if (me) setMyRole(me.role);
            break;

          case 'role_changed':
            setMyRole(msg.newRole as CollabSession['myRole']);
            break;

          case 'kicked':
            setKickReason(msg.reason as string);
            setIsConnected(false);
            ws.close();
            break;

          case 'pong':
            break;

          case 'error':
            console.error(`[useCollabSession] Server error ${msg.code}:`, msg.message);
            break;
        }
      };

      ws.onclose = (event) => {
        if (pingInterval) clearInterval(pingInterval);
        setIsConnected(false);
        setPeers([]);
        wsRef.current = null;

        // Auto-reconnect with exponential backoff (max 5 attempts, max 30s)
        if (!mountedRef.current) return;
        if (event.code === 1008 /* policy violation — kicked, auth timeout */) return;
        if (reconnectRef.current >= 5) {
          console.warn('[useCollabSession] Max reconnect attempts reached');
          return;
        }

        const delay = Math.min(1000 * 2 ** reconnectRef.current, 30_000);
        reconnectRef.current++;
        console.log(`[useCollabSession] Reconnecting in ${delay}ms (attempt ${reconnectRef.current})`);
        setTimeout(connect, delay);
      };

      ws.onerror = (err) => {
        console.error('[useCollabSession] WS error:', err);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (pingInterval) clearInterval(pingInterval);
      const ws = wsRef.current;
      if (ws) {
        ws.send(JSON.stringify({ type: 'leave', journalId }));
        ws.close(1000, 'unmount');
        wsRef.current = null;
      }
      setIsConnected(false);
      setPeers([]);
    };
  }, [enabled, journalId]);

  if (!enabled) return NOOP_SESSION;

  return {
    isConnected,
    peers,
    myColor,
    myRole,
    kickReason,
    sendUpdate,
    sendCursor,
    onUpdate,
  };
}
