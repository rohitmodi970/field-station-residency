'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  User,
  Mail,
  Briefcase,
  Linkedin,
  Twitter,
  Phone,
  Link as LinkIcon,
  FileText,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Zap,
  Plus,
  Trash2,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface AgentProfile {
  name: string;
  email: string;
  bio: string;
  linkedin: string;
  twitter: string;
  company: string;
  role: string;
  phone: string;
  website: string;
  customAnswers: Record<string, string>;
}

interface AgentEvent {
  type: 'LOG' | 'PROGRESS' | 'STREAMING_URL' | 'COMPLETE' | 'ERROR';
  message: string;
  runId?: string;
  streamingUrl?: string;
  status?: 'SUCCESS' | 'FAILED';
  result?: Record<string, unknown> | null;
}

const DEFAULT_PROFILE: AgentProfile = {
  name: '',
  email: '',
  bio: '',
  linkedin: '',
  twitter: '',
  company: '',
  role: '',
  phone: '',
  website: '',
  customAnswers: {},
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function AgentRegistration() {
  // ---- state ----
  const [profile, setProfile] = useState<AgentProfile>(DEFAULT_PROFILE);
  const [eventUrl, setEventUrl] = useState('');
  const [logs, setLogs] = useState<AgentEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null);
  const [finalStatus, setFinalStatus] = useState<'SUCCESS' | 'FAILED' | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(true);
  const [showCustomAnswers, setShowCustomAnswers] = useState(false);
  const [newQKey, setNewQKey] = useState('');
  const [newAKey, setNewAKey] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Load profile on mount
  useEffect(() => {
    fetch('/api/agent/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.name !== undefined) {
          setProfile(data);
          if (data.name && data.email) setProfileSaved(true);
        }
      })
      .catch(() => {});
  }, []);

  // ---- handlers ----

  const handleSaveProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      if (data.success) {
        setProfileSaved(true);
        setProfileExpanded(false);
      }
    } catch {
      /* silent */
    }
  }, [profile]);

  const handleRegister = useCallback(async () => {
    if (!eventUrl || isRunning) return;

    setLogs([]);
    setIsRunning(true);
    setFinalStatus(null);
    setStreamingUrl(null);

    try {
      const res = await fetch('/api/agent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventUrl }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setLogs((prev) => [
          ...prev,
          { type: 'ERROR', message: err.error || `HTTP ${res.status}` },
        ]);
        setFinalStatus('FAILED');
        setIsRunning(false);
        return;
      }

      // Read SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop()!;

        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const event: AgentEvent = JSON.parse(jsonStr);
              setLogs((prev) => [...prev, event]);

              if (event.type === 'STREAMING_URL' && event.streamingUrl) {
                setStreamingUrl(event.streamingUrl);
              }
              if (event.type === 'COMPLETE') {
                setFinalStatus(event.status || 'FAILED');
              }
              if (event.type === 'ERROR') {
                setFinalStatus('FAILED');
              }
            } catch {
              /* skip malformed */
            }
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection error';
      setLogs((prev) => [...prev, { type: 'ERROR', message: msg }]);
      setFinalStatus('FAILED');
    } finally {
      setIsRunning(false);
    }
  }, [eventUrl, isRunning]);

  const addCustomAnswer = () => {
    if (!newQKey.trim()) return;
    setProfile((p) => ({
      ...p,
      customAnswers: { ...p.customAnswers, [newQKey.trim()]: newAKey.trim() },
    }));
    setNewQKey('');
    setNewAKey('');
    setProfileSaved(false);
  };

  const removeCustomAnswer = (key: string) => {
    setProfile((p) => {
      const copy = { ...p.customAnswers };
      delete copy[key];
      return { ...p, customAnswers: copy };
    });
    setProfileSaved(false);
  };

  const updateField = (field: keyof AgentProfile, value: string) => {
    setProfile((p) => ({ ...p, [field]: value }));
    setProfileSaved(false);
  };

  // Whether we're in "live view" mode (agent running or just finished with stream)
  const isLiveMode = isRunning || (streamingUrl !== null && finalStatus === null);

  const previewRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the live preview when it appears
  useEffect(() => {
    if (streamingUrl && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [streamingUrl]);

  // ---- render ----

  // ═══════════════════════════════════════════════════════════════
  // LIVE MODE — full-screen-like preview with compact log overlay
  // ═══════════════════════════════════════════════════════════════
  if (isLiveMode || (finalStatus && streamingUrl)) {
    return (
      <div ref={previewRef} className="flex flex-col h-[calc(100vh-6rem)] p-2 md:p-4 gap-3">
        {/* Top bar */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Force Agent</h1>
              <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                {eventUrl}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isRunning && (
              <span className="flex items-center gap-2 text-sm font-medium text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Agent Running
              </span>
            )}
            {finalStatus === 'SUCCESS' && (
              <span className="flex items-center gap-2 text-sm font-medium text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                Registration Successful
              </span>
            )}
            {finalStatus === 'FAILED' && (
              <span className="flex items-center gap-2 text-sm font-medium text-red-500">
                <XCircle className="h-4 w-4" />
                Registration Failed
              </span>
            )}
            {/* Back button (after completion) */}
            {!isRunning && finalStatus && (
              <button
                type="button"
                onClick={() => {
                  setStreamingUrl(null);
                  setFinalStatus(null);
                  setLogs([]);
                }}
                className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
              >
                New Registration
              </button>
            )}
          </div>
        </div>

        {/* Main area — preview + log sidebar */}
        <div className="flex-1 min-h-0 flex gap-3">
          {/* Live browser preview — takes most space */}
          <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
            {streamingUrl ? (
              <>
                <div className="px-4 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                    </span>
                    Live Browser View
                  </span>
                  <a
                    href={streamingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Open in new tab <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <iframe
                  src={streamingUrl}
                  title="Agent Browser Stream"
                  className="flex-1 w-full border-0"
                  allow="autoplay"
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/50" />
                  <p className="text-sm">Connecting to browser agent…</p>
                </div>
              </div>
            )}
          </div>

          {/* Compact log sidebar */}
          <div className="w-72 lg:w-80 flex-shrink-0 rounded-2xl border border-border bg-card flex flex-col overflow-hidden hidden md:flex">
            <div className="px-4 py-2 border-b border-border flex-shrink-0">
              <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                Execution Log
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-1.5 font-mono text-[11px]">
              {logs.map((log, i) => (
                <LogLine key={i} event={log} />
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Mobile log — collapsible at bottom */}
        <div className="md:hidden flex-shrink-0">
          <details className="rounded-2xl border border-border bg-card overflow-hidden">
            <summary className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:bg-muted/50">
              Execution Log ({logs.length})
            </summary>
            <div className="max-h-[200px] overflow-y-auto px-4 py-3 space-y-1.5 font-mono text-[11px]">
              {logs.map((log, i) => (
                <LogLine key={i} event={log} />
              ))}
              <div ref={logEndRef} />
            </div>
          </details>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // SETUP MODE — profile editor + event URL input (default view)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="container mx-auto max-w-4xl py-10 px-4 space-y-8">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-2"
      >
        <div className="flex justify-center mb-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Tool Adapter: TinyFish Browser Automation
          </div>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold">TinyFish Automation Studio</h1>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm">
          A dedicated tool adapter within the unified Force Agent control plane. Automates event registrations end-to-end and writes outcomes directly into your Vektori memory.
        </p>
      </motion.div>

      {/* ── Profile Section ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm"
      >
        <button
          type="button"
          onClick={() => setProfileExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-6 py-4"
        >
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">Your Profile</span>
            {profileSaved && (
              <span className="text-xs bg-green-500/15 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
                Saved
              </span>
            )}
          </div>
          {profileExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        <AnimatePresence>
          {profileExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 space-y-4">
                {/* Row: Name + Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    icon={<User className="h-4 w-4" />}
                    label="Full Name *"
                    value={profile.name}
                    onChange={(v) => updateField('name', v)}
                    placeholder="Jane Doe"
                  />
                  <InputField
                    icon={<Mail className="h-4 w-4" />}
                    label="Email *"
                    type="email"
                    value={profile.email}
                    onChange={(v) => updateField('email', v)}
                    placeholder="jane@example.com"
                  />
                </div>

                {/* Row: Company + Role */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    icon={<Briefcase className="h-4 w-4" />}
                    label="Company"
                    value={profile.company}
                    onChange={(v) => updateField('company', v)}
                    placeholder="Acme Inc."
                  />
                  <InputField
                    icon={<Briefcase className="h-4 w-4" />}
                    label="Role / Title"
                    value={profile.role}
                    onChange={(v) => updateField('role', v)}
                    placeholder="Software Engineer"
                  />
                </div>

                {/* Row: LinkedIn + Twitter */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    icon={<Linkedin className="h-4 w-4" />}
                    label="LinkedIn"
                    value={profile.linkedin}
                    onChange={(v) => updateField('linkedin', v)}
                    placeholder="linkedin.com/in/janedoe"
                  />
                  <InputField
                    icon={<Twitter className="h-4 w-4" />}
                    label="Twitter / X"
                    value={profile.twitter}
                    onChange={(v) => updateField('twitter', v)}
                    placeholder="@janedoe"
                  />
                </div>

                {/* Row: Phone + Website */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    icon={<Phone className="h-4 w-4" />}
                    label="Phone"
                    value={profile.phone}
                    onChange={(v) => updateField('phone', v)}
                    placeholder="+1 555 000 0000"
                  />
                  <InputField
                    icon={<LinkIcon className="h-4 w-4" />}
                    label="Website"
                    value={profile.website}
                    onChange={(v) => updateField('website', v)}
                    placeholder="https://janedoe.dev"
                  />
                </div>

                {/* Bio */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="h-4 w-4" /> Bio
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[80px] resize-y"
                    value={profile.bio}
                    onChange={(e) => updateField('bio', e.target.value)}
                    placeholder="A short bio used for event registrations..."
                  />
                </div>

                {/* Custom Answers */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowCustomAnswers((v) => !v)}
                    className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    {showCustomAnswers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    Custom Form Answers
                  </button>

                  <AnimatePresence>
                    {showCustomAnswers && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-3"
                      >
                        <p className="text-xs text-muted-foreground">
                          Add common form questions and answers (e.g. &quot;Why do you
                          want to attend?&quot;)
                        </p>

                        {Object.entries(profile.customAnswers).map(
                          ([q, a]) => (
                            <div
                              key={q}
                              className="flex items-start gap-2 bg-muted/50 rounded-lg p-3"
                            >
                              <div className="flex-1 space-y-1">
                                <p className="text-xs font-medium">{q}</p>
                                <p className="text-sm text-muted-foreground">
                                  {a}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeCustomAnswer(q)}
                                className="text-destructive hover:text-destructive/80 p-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ),
                        )}

                        {/* Add new Q/A */}
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                          <input
                            className="rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                            placeholder="Question"
                            value={newQKey}
                            onChange={(e) => setNewQKey(e.target.value)}
                          />
                          <input
                            className="rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                            placeholder="Answer"
                            value={newAKey}
                            onChange={(e) => setNewAKey(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={addCustomAnswer}
                            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm hover:bg-primary/90 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Save button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    Save Profile
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Event URL + Register ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm p-6 space-y-4"
      >
        <label className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
          <Globe className="h-4 w-4" /> Luma Event URL
        </label>
        <input
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          value={eventUrl}
          onChange={(e) => setEventUrl(e.target.value)}
          placeholder="https://lu.ma/your-event"
        />

        <button
          type="button"
          disabled={isRunning || !eventUrl || !profileSaved}
          onClick={handleRegister}
          className={cn(
            'w-full inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold px-6 py-3 transition-colors',
            isRunning
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Agent Running…
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              Register with Force
            </>
          )}
        </button>

        {!profileSaved && (
          <p className="text-xs text-amber-500">
            Save your profile above before registering.
          </p>
        )}
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function InputField({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
        {icon} {label}
      </label>
      <input
        type={type}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function LogLine({ event }: { event: AgentEvent }) {
  const colorMap: Record<string, string> = {
    LOG: 'text-muted-foreground',
    PROGRESS: 'text-blue-500',
    STREAMING_URL: 'text-purple-500',
    COMPLETE: event.status === 'SUCCESS' ? 'text-green-500' : 'text-red-500',
    ERROR: 'text-red-500',
  };

  const prefixMap: Record<string, string> = {
    LOG: '●',
    PROGRESS: '▸',
    STREAMING_URL: '🔗',
    COMPLETE: event.status === 'SUCCESS' ? '✓' : '✗',
    ERROR: '✗',
  };

  return (
    <div className={cn('flex gap-2', colorMap[event.type] || 'text-muted-foreground')}>
      <span className="flex-shrink-0 w-4 text-center">
        {prefixMap[event.type] || '●'}
      </span>
      <span className="break-all">{event.message}</span>
    </div>
  );
}
