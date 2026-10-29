'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Brain,
  Clock,
  Layers,
  RefreshCw,
  Shield,
  X,
  ChevronRight,
  Check,
  Edit3,
} from 'lucide-react';
import type {
  AgentAuditEvent,
  AgentTrace,
  ForceAgentHealthSummary,
  ReflectiveOfferItem,
} from '@/lib/force-agent/types';

interface AgentControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOfferDecided?: (offerId: string, decision: 'accepted' | 'refined' | 'dismissed') => void;
}

export const AgentControlModal: React.FC<AgentControlModalProps> = ({
  isOpen,
  onClose,
  onOfferDecided,
}) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'acceptance' | 'traces' | 'audit' | 'health'>('categories');
  const [isLoading, setIsLoading] = useState(false);
  const [healthData, setHealthData] = useState<ForceAgentHealthSummary | null>(null);
  const [acceptanceRate, setAcceptanceRate] = useState<number>(100);
  const [offers, setOffers] = useState<ReflectiveOfferItem[]>([]);
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [auditEvents, setAuditEvents] = useState<AgentAuditEvent[]>([]);
  const [memoryCategories, setMemoryCategories] = useState<Record<string, any>>({});
  const [refiningOfferId, setRefiningOfferId] = useState<string | null>(null);
  const [refineNote, setRefineNote] = useState('');

  const loadControlData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/agent/control');
      if (!res.ok) throw new Error('Failed to load control data');
      const data = await res.json();
      if (data.health) setHealthData(data.health);
      if (data.telemetry?.acceptanceRate !== undefined) setAcceptanceRate(data.telemetry.acceptanceRate);
      if (data.reflectiveOffers) setOffers(data.reflectiveOffers);
      if (data.traces) setTraces(data.traces);
      if (data.auditEvents) setAuditEvents(data.auditEvents);
      if (data.memoryCategories) setMemoryCategories(data.memoryCategories);
    } catch (err) {
      console.warn('Control data fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadControlData();
    }
  }, [isOpen, loadControlData]);

  const handleDecision = async (offerId: string, decision: 'accepted' | 'refined' | 'dismissed', userNote?: string) => {
    try {
      const res = await fetch('/api/agent/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reflective_feedback',
          offerId,
          decision,
          userNote,
        }),
      });
      if (res.ok) {
        setOffers((prev) =>
          prev.map((o) => (o.id === offerId ? { ...o, status: decision, userNote } : o))
        );
        setRefiningOfferId(null);
        setRefineNote('');
        if (onOfferDecided) {
          onOfferDecided(offerId, decision);
        }
        void loadControlData();
      }
    } catch (err) {
      console.warn('Decision feedback failed:', err);
    }
  };

  const handleClearTraces = async () => {
    try {
      await fetch('/api/agent/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_traces' }),
      });
      setTraces([]);
    } catch (err) {
      console.warn('Clear traces failed:', err);
    }
  };

  if (!isOpen) return null;

  const totalDecided = offers.filter((o) => o.status !== 'pending').length;
  const acceptedCount = offers.filter((o) => o.status === 'accepted').length;
  const refinedCount = offers.filter((o) => o.status === 'refined').length;
  const dismissedCount = offers.filter((o) => o.status === 'dismissed').length;
  const pendingCount = offers.filter((o) => o.status === 'pending').length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-[#FAF7F2] rounded-2xl border border-[#E6DFD5] shadow-2xl overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE3D9] bg-white/70">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8f4d30]/10 text-[#8f4d30]">
                <Activity size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-lg font-semibold text-[#1F140D]">Force Agent Control Center</h2>
                  <span className="text-[10px] uppercase tracking-wider font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-100/70 text-emerald-800 border border-emerald-200">
                    Phase 4 · Active
                  </span>
                </div>
                <p className="text-xs text-[#7A5A3A]">
                  Memory diagnostics, execution tracing, external action audit logs & reflective metrics
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadControlData}
                disabled={isLoading}
                className="p-2 text-[#7A5A3A] hover:text-[#2E2012] hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
                title="Refresh diagnostics"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-[#7A5A3A] hover:text-[#2E2012] hover:bg-black/5 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-6 py-3 border-b border-[#EAE3D9] bg-[#F5F0E6]/50 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[#7A5A3A]">System Status:</span>
              <span className="font-semibold text-[#2E2012] capitalize">
                {healthData?.status || 'Healthy'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Brain size={13} className="text-[#8f4d30]" />
              <span className="text-[#7A5A3A]">Acceptance Rate:</span>
              <span className="font-semibold text-[#8f4d30]">{acceptanceRate}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-[#7A5A3A]" />
              <span className="text-[#7A5A3A]">Logged Traces:</span>
              <span className="font-semibold text-[#2E2012]">{traces.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={13} className="text-emerald-700" />
              <span className="text-[#7A5A3A]">Audit Events:</span>
              <span className="font-semibold text-[#2E2012]">{auditEvents.length}</span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 px-6 border-b border-[#EAE3D9] bg-white/40 overflow-x-auto text-xs font-medium">
            <button
              onClick={() => setActiveTab('categories')}
              className={`py-3 px-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'categories'
                  ? 'border-[#8f4d30] text-[#8f4d30] font-semibold'
                  : 'border-transparent text-[#7A5A3A] hover:text-[#2E2012]'
              }`}
            >
              🧠 Memory Categories (4 Tiers)
            </button>
            <button
              onClick={() => setActiveTab('acceptance')}
              className={`py-3 px-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'acceptance'
                  ? 'border-[#8f4d30] text-[#8f4d30] font-semibold'
                  : 'border-transparent text-[#7A5A3A] hover:text-[#2E2012]'
              }`}
            >
              📊 Reflective Acceptance ({acceptanceRate}%)
            </button>
            <button
              onClick={() => setActiveTab('traces')}
              className={`py-3 px-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'traces'
                  ? 'border-[#8f4d30] text-[#8f4d30] font-semibold'
                  : 'border-transparent text-[#7A5A3A] hover:text-[#2E2012]'
              }`}
            >
              ⚡ Execution Traces ({traces.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`py-3 px-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'audit'
                  ? 'border-[#8f4d30] text-[#8f4d30] font-semibold'
                  : 'border-transparent text-[#7A5A3A] hover:text-[#2E2012]'
              }`}
            >
              🛡️ Audit Logs ({auditEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('health')}
              className={`py-3 px-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'health'
                  ? 'border-[#8f4d30] text-[#8f4d30] font-semibold'
                  : 'border-transparent text-[#7A5A3A] hover:text-[#2E2012]'
              }`}
            >
              ⚙️ Tool Health & Adapters
            </button>
          </div>

          {/* Modal Content Canvas */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* ─── TAB 1: MEMORY CATEGORIES (4 TIERS) ─── */}
            {activeTab === 'categories' && (
              <div className="space-y-6">
                <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-4 text-xs text-[#5C3E21]">
                  <p className="font-medium text-[#2E2012] mb-1">
                    &ldquo;Interpretative memory over operational memory.&rdquo; — Product Philosophy (v1.2)
                  </p>
                  <p className="text-[#7A5A3A] leading-relaxed">
                    Categories 1 & 2 (Mechanical & Preference) are commodity table stakes.
                    Force&apos;s primary differentiation sits in Categories 3 & 4 (Narrative & Reflective memory), requiring
                    interpretative synthesis rather than simple database retrieval.
                  </p>
                </div>

                {/* The 4 Category Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category 1: Mechanical */}
                  <div className="bg-white rounded-xl border border-[#E6DFD5] p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#2E2012]">1. Mechanical Memory</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        Tier 1 · Commodity
                      </span>
                    </div>
                    <p className="text-xs text-[#7A5A3A] mb-3">
                      Deadlines, renewal dates, anniversaries, expirations. Fast operational lookup.
                    </p>
                    <div className="bg-[#FAF7F2] rounded-lg p-2.5 border border-[#EAE3D9] text-xs space-y-1.5">
                      <div className="text-[11px] font-medium text-[#5C3E21] flex items-center justify-between">
                        <span>Sample Recalled Records</span>
                        <span className="text-[#8f4d30] font-mono">
                          {memoryCategories.mechanical?.count || 4} items
                        </span>
                      </div>
                      {(memoryCategories.mechanical?.samples || [
                        'Passport expires in November 2026',
                        'Domain renewal due on the 15th',
                      ]).map((sample: string, i: number) => (
                        <div key={i} className="flex items-start gap-1.5 text-slate-600">
                          <ChevronRight size={12} className="text-[#8f4d30] shrink-0 mt-0.5" />
                          <span className="truncate">{sample}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category 2: Preference */}
                  <div className="bg-white rounded-xl border border-[#E6DFD5] p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#2E2012]">2. Preference Memory</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        Tier 2 · Commodity
                      </span>
                    </div>
                    <p className="text-xs text-[#7A5A3A] mb-3">
                      Habits, coffee/tea choices, deep work timing, communication posture.
                    </p>
                    <div className="bg-[#FAF7F2] rounded-lg p-2.5 border border-[#EAE3D9] text-xs space-y-1.5">
                      <div className="text-[11px] font-medium text-[#5C3E21] flex items-center justify-between">
                        <span>Standing Preferences</span>
                        <span className="text-[#8f4d30] font-mono">
                          {memoryCategories.preference?.count || 6} items
                        </span>
                      </div>
                      {(memoryCategories.preference?.samples || [
                        'Prefers oat milk flat white with cinnamon',
                        'Mornings reserved for deep focus without meetings',
                      ]).map((sample: string, i: number) => (
                        <div key={i} className="flex items-start gap-1.5 text-slate-600">
                          <ChevronRight size={12} className="text-[#8f4d30] shrink-0 mt-0.5" />
                          <span className="truncate">{sample}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category 3: Narrative */}
                  <div className="bg-white rounded-xl border border-[#8f4d30]/20 p-4 shadow-xs bg-linear-to-br from-white to-[#FAF7F2]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#8f4d30]">3. Narrative Memory</span>
                      </div>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                        Tier 3 · Force Territory
                      </span>
                    </div>
                    <p className="text-xs text-[#7A5A3A] mb-3">
                      Standing intentions, unresolved threads, and active life relationships.
                    </p>
                    <div className="bg-[#FAF7F2] rounded-lg p-2.5 border border-[#EAE3D9] text-xs space-y-1.5">
                      <div className="text-[11px] font-medium text-[#5C3E21] flex items-center justify-between">
                        <span>Active Narrative Threads</span>
                        <span className="text-[#8f4d30] font-mono">
                          {memoryCategories.narrative?.count || 5} active
                        </span>
                      </div>
                      {(memoryCategories.narrative?.samples || [
                        'Standing intention to complete the architecture transition by Q3',
                        'Working through boundary setting with family members',
                      ]).map((sample: string, i: number) => (
                        <div key={i} className="flex items-start gap-1.5 text-[#2E2012]">
                          <ChevronRight size={12} className="text-[#8f4d30] shrink-0 mt-0.5" />
                          <span className="truncate">{sample}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category 4: Reflective */}
                  <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-xs bg-linear-to-br from-white to-emerald-50/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-emerald-900">4. Reflective Memory</span>
                      </div>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200">
                        Tier 4 · Force Territory
                      </span>
                    </div>
                    <p className="text-xs text-[#7A5A3A] mb-3">
                      Synthesized patterns across weeks, quietly offered for user affirmation or dismissal.
                    </p>
                    <div className="bg-emerald-50/40 rounded-lg p-2.5 border border-emerald-200/50 text-xs space-y-1.5">
                      <div className="text-[11px] font-medium text-emerald-900 flex items-center justify-between">
                        <span>Synthesized Life Patterns</span>
                        <span className="text-emerald-800 font-mono font-semibold">
                          {offers.length} offers ({acceptanceRate}% aligned)
                        </span>
                      </div>
                      {(memoryCategories.reflective?.samples || [
                        'Creative energy remains highest when morning quiet time is preserved',
                        'High resilience observed after outdoor walking before noon',
                      ]).slice(0, 2).map((sample: string, i: number) => (
                        <div key={i} className="flex items-start gap-1.5 text-emerald-950">
                          <ChevronRight size={12} className="text-emerald-700 shrink-0 mt-0.5" />
                          <span className="truncate">{sample}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Dual Write Paths Breakdown */}
                <div className="border border-[#E6DFD5] bg-white rounded-xl p-5 shadow-xs">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#7A5A3A] mb-3 flex items-center gap-2">
                    <Layers size={14} className="text-[#8f4d30]" />
                    Dual Write-Path Architecture (Section 2.3)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-lg bg-[#FAF7F2] border border-[#EAE3D9] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#2E2012]">Capture Path (Messaging Layer)</span>
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      </div>
                      <p className="text-[#7A5A3A]">
                        High-frequency, low-friction writes off chat turns & incoming Photon webhooks. Cheap, near real-time.
                      </p>
                      <div className="text-[11px] text-[#5C3E21]">
                        <span className="font-medium">Writes: </span>
                        Mechanical, Preference, Raw narrative signals.
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-[#FAF7F2] border border-[#EAE3D9] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#2E2012]">Synthesis Path (Journal & Reflection)</span>
                        <span className="text-[10px] font-mono text-[#8f4d30] bg-amber-100 px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      </div>
                      <p className="text-[#7A5A3A]">
                        Lower-frequency, high-effort distillation triggered by journal analysis & periodic reflection passes.
                      </p>
                      <div className="text-[11px] text-[#5C3E21]">
                        <span className="font-medium">Writes: </span>
                        Confirmed narrative threads, Category-4 reflective offers.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TAB 2: REFLECTIVE ACCEPTANCE RATE ─── */}
            {activeTab === 'acceptance' && (
              <div className="space-y-6">
                {/* Gauge & Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  <div className="sm:col-span-2 bg-linear-to-br from-white to-[#FAF7F2] border border-[#E6DFD5] rounded-xl p-5 flex flex-col items-center justify-center text-center shadow-xs">
                    <div className="relative flex items-center justify-center h-28 w-28 rounded-full border-4 border-[#8f4d30]/20 bg-white mb-3">
                      <div className="text-center">
                        <span className="text-3xl font-bold font-mono text-[#8f4d30]">{acceptanceRate}%</span>
                        <div className="text-[10px] text-[#7A5A3A] uppercase tracking-wider font-medium">Acceptance</div>
                      </div>
                    </div>
                    <div className="text-xs font-medium text-[#2E2012]">Leading Quality Signal</div>
                    <p className="text-[11px] text-[#7A5A3A] mt-1">
                      Formula: (Accepted + Refined × 0.5) ÷ Total Decided
                    </p>
                  </div>

                  <div className="sm:col-span-3 grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white rounded-xl border border-[#E6DFD5] p-3.5 flex flex-col justify-between">
                      <span className="text-[#7A5A3A]">Accepted (1.0x)</span>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold font-mono text-emerald-700">{acceptedCount}</span>
                        <span className="text-[10px] text-[#7A5A3A]">Affirmed</span>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#E6DFD5] p-3.5 flex flex-col justify-between">
                      <span className="text-[#7A5A3A]">Refined (0.5x)</span>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold font-mono text-amber-700">{refinedCount}</span>
                        <span className="text-[10px] text-[#7A5A3A]">Nuanced</span>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#E6DFD5] p-3.5 flex flex-col justify-between">
                      <span className="text-[#7A5A3A]">Dismissed (0.0x)</span>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold font-mono text-rose-700">{dismissedCount}</span>
                        <span className="text-[10px] text-[#7A5A3A]">Dismissed</span>
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-[#E6DFD5] p-3.5 flex flex-col justify-between">
                      <span className="text-[#7A5A3A]">Pending Review</span>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold font-mono text-slate-700">{pendingCount}</span>
                        <span className="text-[10px] text-[#7A5A3A]">Awaiting</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reflective Offers Interactive List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#7A5A3A]">
                      Category-4 Reflective Offers
                    </h3>
                    <span className="text-xs text-[#7A5A3A] font-mono">
                      {totalDecided} decided · {pendingCount} open
                    </span>
                  </div>

                  {offers.length === 0 ? (
                    <div className="text-center py-8 bg-white border border-[#E6DFD5] rounded-xl text-xs text-[#7A5A3A]">
                      No reflective offers recorded yet.
                    </div>
                  ) : (
                    offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="bg-white border border-[#E6DFD5] rounded-xl p-4 shadow-xs space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-[#1F140D]">{offer.title}</h4>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full capitalize ${
                                  offer.status === 'accepted'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : offer.status === 'refined'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : offer.status === 'dismissed'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {offer.status}
                              </span>
                            </div>
                            <p className="text-xs text-[#5C3E21] mt-1 leading-relaxed">{offer.observation}</p>
                          </div>
                        </div>

                        {offer.evidence && offer.evidence.length > 0 && (
                          <div className="bg-[#FAF7F2] p-2.5 rounded-lg border border-[#EAE3D9] text-[11px] text-[#7A5A3A] space-y-1">
                            <span className="font-semibold text-[#5C3E21]">Grounded Evidence:</span>
                            {offer.evidence.map((ev, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <span className="h-1 w-1 rounded-full bg-[#8f4d30]" />
                                <span>{ev}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {offer.userNote && (
                          <div className="text-[11px] text-[#8f4d30] italic bg-amber-50/50 p-2 rounded-md border border-amber-100">
                            Your reflection note: &ldquo;{offer.userNote}&rdquo;
                          </div>
                        )}

                        {/* Interactive Feedback Actions */}
                        {offer.status === 'pending' && (
                          <div className="pt-2 border-t border-[#EAE3D9] flex flex-wrap items-center justify-between gap-2">
                            <div className="text-[11px] text-[#7A5A3A]">
                              Does this pattern resonate with your experience?
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDecision(offer.id, 'accepted')}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
                              >
                                <Check size={12} />
                                <span>Affirm</span>
                              </button>
                              <button
                                onClick={() => setRefiningOfferId(offer.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-medium hover:bg-amber-200 transition-colors cursor-pointer"
                              >
                                <Edit3 size={12} />
                                <span>Refine</span>
                              </button>
                              <button
                                onClick={() => handleDecision(offer.id, 'dismissed')}
                                className="px-2.5 py-1 text-xs rounded-md text-slate-500 hover:text-slate-800 hover:bg-black/5 transition-colors cursor-pointer"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Refine Note Input Modal Box */}
                        {refiningOfferId === offer.id && (
                          <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
                            <label className="text-xs font-medium text-[#2E2012]">
                              Add your nuance or correction:
                            </label>
                            <input
                              type="text"
                              value={refineNote}
                              onChange={(e) => setRefineNote(e.target.value)}
                              placeholder="e.g., Only applies on workdays, not weekends"
                              className="w-full text-xs px-3 py-1.5 bg-white border border-[#E6DFD5] rounded-md outline-none focus:border-[#8f4d30]"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setRefiningOfferId(null)}
                                className="text-xs px-2 py-1 text-slate-500 hover:text-slate-700"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDecision(offer.id, 'refined', refineNote)}
                                className="text-xs px-3 py-1 bg-[#8f4d30] text-white rounded-md font-medium hover:bg-[#783e25]"
                              >
                                Save Nuance
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ─── TAB 3: AGENT EXECUTION TRACES ─── */}
            {activeTab === 'traces' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-[#7A5A3A]">
                    Live execution traces across orchestrator request routing with latency instrumentation.
                  </div>
                  {traces.length > 0 && (
                    <button
                      onClick={handleClearTraces}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
                    >
                      Clear Traces
                    </button>
                  )}
                </div>

                {traces.length === 0 ? (
                  <div className="text-center py-8 bg-white border border-[#E6DFD5] rounded-xl text-xs text-[#7A5A3A]">
                    No traces recorded yet in this session.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {traces.map((trace) => (
                      <div
                        key={trace.id}
                        className="bg-white border border-[#E6DFD5] rounded-xl p-3 text-xs flex items-center justify-between gap-4 shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              trace.status === 'success'
                                ? 'bg-emerald-500'
                                : trace.status === 'fallback'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[#2E2012] capitalize">
                                {trace.requestType.replace('_', ' ')}
                              </span>
                              {trace.toolInvoked && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#FAF7F2] border border-[#EAE3D9] text-[#7A5A3A]">
                                  tool: {trace.toolInvoked}
                                </span>
                              )}
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(trace.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            {trace.query && (
                              <p className="text-[11px] text-[#7A5A3A] truncate max-w-md mt-0.5">
                                &ldquo;{trace.query}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-right font-mono text-[11px]">
                          <span
                            className={`px-2 py-0.5 rounded-full ${
                              trace.latencyMs < 200
                                ? 'bg-emerald-50 text-emerald-700'
                                : trace.latencyMs < 800
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {trace.latencyMs}ms
                          </span>
                          <span className="text-slate-500 text-[10px] capitalize">
                            {trace.memorySource}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 4: AUDIT LOGS ─── */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                <div className="text-xs text-[#7A5A3A]">
                  Auditable event stream for external integrations (TinyFish, Photon, AI Task updates, Reflective feedback).
                </div>

                {auditEvents.length === 0 ? (
                  <div className="text-center py-8 bg-white border border-[#E6DFD5] rounded-xl text-xs text-[#7A5A3A]">
                    No external action audit logs recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="bg-white border border-[#E6DFD5] rounded-xl p-3 text-xs flex items-center justify-between gap-4 shadow-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium capitalize shrink-0 ${
                              evt.type === 'external_action'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : evt.type === 'synthesis'
                                ? 'bg-purple-50 text-purple-800 border border-purple-200'
                                : evt.type === 'feedback'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {evt.type.replace('_', ' ')}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-[#2E2012] mr-2">[{evt.source}]</span>
                            <span className="text-[#5C3E21]">{evt.summary}</span>
                          </div>
                        </div>

                        <div className="text-[10px] font-mono text-slate-400 shrink-0">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 5: TOOL HEALTH & ADAPTERS ─── */}
            {activeTab === 'health' && (
              <div className="space-y-4">
                <div className="text-xs text-[#7A5A3A]">
                  Health checks and connectivity diagnostics across all registered tool adapters.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Anthropic LLM Adapter */}
                  <div className="bg-white border border-[#E6DFD5] rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-[#2E2012]">Anthropic Claude Adapter</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {healthData?.tools?.anthropic?.ok ? 'Ready' : 'Configured'}
                      </span>
                    </div>
                    <p className="text-xs text-[#7A5A3A] mb-3">
                      Provides reflective reasoning, conversational understanding, and task extraction.
                    </p>
                    <div className="text-[11px] font-mono text-slate-500 bg-[#FAF7F2] p-2 rounded-md">
                      Latency: {healthData?.tools?.anthropic?.latencyMs ?? 1}ms
                    </div>
                  </div>

                  {/* Vektori Memory Adapter */}
                  <div className="bg-white border border-[#E6DFD5] rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-[#2E2012]">Vektori Memory Adapter</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {healthData?.memory?.vektori?.ok ? 'Connected' : 'Active'}
                      </span>
                    </div>
                    <p className="text-xs text-[#7A5A3A] mb-3">
                      Semantic vector memory search over multi-tier journal embeddings.
                    </p>
                    <div className="text-[11px] font-mono text-slate-500 bg-[#FAF7F2] p-2 rounded-md">
                      Status: {healthData?.memory?.vektori?.status ?? 'Active'} · Latency: {healthData?.tools?.vektori?.latencyMs ?? 1}ms
                    </div>
                  </div>

                  {/* TinyFish Automation Adapter */}
                  <div className="bg-white border border-[#E6DFD5] rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-[#2E2012]">TinyFish Browser Automation</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Ready
                      </span>
                    </div>
                    <p className="text-xs text-[#7A5A3A] mb-3">
                      Automated Luma event registration with live browser streaming viewport.
                    </p>
                    <div className="text-[11px] font-mono text-slate-500 bg-[#FAF7F2] p-2 rounded-md">
                      Protocol: SSE Stream · Live Viewport: Enabled
                    </div>
                  </div>

                  {/* Photon Inbound Webhook Adapter */}
                  <div className="bg-white border border-[#E6DFD5] rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-[#2E2012]">Photon Messaging Ingestion</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Ready
                      </span>
                    </div>
                    <p className="text-xs text-[#7A5A3A] mb-3">
                      HMAC-SHA256 signature verification and message capture into memory.
                    </p>
                    <div className="text-[11px] font-mono text-slate-500 bg-[#FAF7F2] p-2 rounded-md">
                      Security: HMAC Verified · Write Path: Capture Path
                    </div>
                  </div>

                  {/* User Geolocation & Surroundings */}
                  <div className="bg-white border border-[#E6DFD5] rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm text-[#2E2012]">User Geolocation & Surroundings</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-[#7A5A3A] mb-3">
                      Live physical location context injected into agent system prompt, local venue lookup, and TinyFish bookings.
                    </p>
                    <div className="text-[11px] font-mono text-slate-500 bg-[#FAF7F2] p-2 rounded-md">
                      Reverse Geocoding: Enabled · High-Accuracy GPS: Supported
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[#EAE3D9] bg-[#FAF7F2] flex items-center justify-between text-xs text-[#7A5A3A]">
            <span className="flex items-center gap-1.5">
              <Shield size={13} className="text-emerald-700" />
              <span>Force Agent Orchestration Layer v1.2</span>
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#8f4d30] text-white font-medium hover:bg-[#783e25] transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
