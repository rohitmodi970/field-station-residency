'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Search,
  Brain,
  Compass,
  Mic,
  CheckSquare,
  Square,
  BookOpen,
  BarChart3,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Loader2,
  Check,
  Plus,
  Lock,
  Sparkles,
  Layers,
  Wrench,
  ArrowRight,
  Eye,
  EyeOff,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';

export interface ToolExecution {
  tool: string;
  status: 'success' | 'running' | 'failed' | 'unsupported';
  title?: string;
  message?: string;
  narrative?: string;
  data?: Record<string, any>;
}

export interface TinyFishStreamState {
  status: 'idle' | 'running' | 'success' | 'failed' | 'needs_input';
  streamingUrl?: string;
  currentAction?: string;
  steps?: string[];
  outcome?: any;
  targetUrl?: string;
  missingFields?: string[];
  actionRequired?: string;
}

interface ClaudeToolCallProps {
  toolExecution: ToolExecution;
  messageId: string;
  tinyfishStream?: TinyFishStreamState;
  onRunTinyfish?: (options: {
    url?: string;
    eventUrl?: string;
    goal?: string;
    prompt?: string;
    taskType?: string;
    customAnswers?: Record<string, string>;
    phone?: string;
  }) => void;
  onToggleTodo?: (todoId: string, currentStatus: string) => void;
  onAddCandidateTask?: (task: { title: string; priority?: string; category?: string }, key: string) => void;
  addedCandidateTasks?: Record<string, boolean>;
  onSelectAnalysisMode?: (mode: string, targetDates?: string[]) => void;
  savePatternMapToHistory?: (data: any, title?: string) => string | null;
}

// Convert any object/record into clean, human-readable general English key-value pairs
// Convert any object/record into clean, human-readable general English key-value pairs without duplicates
function renderGeneralEnglishOutcome(
  outcome: any,
  seenLabels: Set<string> = new Set<string>(),
  seenTexts: Set<string> = new Set<string>()
): { label: string; text: string }[] {
  if (!outcome) return [];
  if (typeof outcome === 'string') {
    const trimmed = outcome.trim();
    if (!trimmed || seenTexts.has(trimmed.toLowerCase())) return [];
    seenTexts.add(trimmed.toLowerCase());
    return [{ label: 'Details', text: trimmed }];
  }
  if (typeof outcome !== 'object') {
    const text = String(outcome).trim();
    if (!text || seenTexts.has(text.toLowerCase())) return [];
    seenTexts.add(text.toLowerCase());
    return [{ label: 'Result', text }];
  }

  const items: { label: string; text: string }[] = [];

  // Internal technical keys and nested raw payloads to exclude from user display
  const excludedKeys = new Set([
    'status',
    'category',
    'missingfields',
    'missing_fields',
    'actionstatus',
    'action_status',
    'actionrequired',
    'action_required',
    'isconfirmed',
    'issoldout',
    'rawoutput',
    'raw_output',
    'code',
    'type',
    'error',
    'errortype',
    'error_type',
    'stack',
    'internal',
    'debug',
    'retrycount',
    'retry_count',
    'details',
    'raw',
    'rawevent',
    'raw_event',
    'resultjson',
    'result_json',
    'payload',
    'prompttouser',
    'prompt_to_user',
    'helpmessage',
    'help_message',
    'purpose',
    'reason',
  ]);

  const keyMap: Record<string, string> = {
    message: 'Message',
    confirmed: 'Registration Status',
    eventName: 'Event Name',
    eventTitle: 'Event Title',
    className: 'Session',
    classTime: 'Session Time',
    ticketType: 'Pass / Ticket',
    ticketId: 'Confirmation Number',
    bookingId: 'Booking Reference',
    confirmationUrl: 'Confirmation Link',
    url: 'Website Link',
    email: 'Registered Email',
    name: 'Attendee Name',
    location: 'Location',
    date: 'Date',
    time: 'Time',
    notes: 'Details',
    summary: 'Details',
  };

  for (const [k, v] of Object.entries(outcome)) {
    if (v === null || v === undefined) continue;
    const lowerKey = k.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (excludedKeys.has(lowerKey)) continue;

    if (typeof v === 'object' && !Array.isArray(v)) {
      items.push(...renderGeneralEnglishOutcome(v, seenLabels, seenTexts));
      continue;
    }

    let text = '';
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      text = v.join(', ').trim();
    } else if (typeof v === 'boolean') {
      text = v ? 'Confirmed' : 'Not completed';
    } else {
      text = String(v).trim();
    }

    if (!text) continue;
    const normalizedText = text.toLowerCase();

    // Deduplicate: if this exact text has already been added, never show it again
    if (seenTexts.has(normalizedText)) continue;

    const label = keyMap[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());

    // Deduplicate: if this label has already been added, never show it again
    if (seenLabels.has(label)) continue;

    seenLabels.add(label);
    seenTexts.add(normalizedText);
    items.push({ label, text });
  }

  // Final deduplication pass to guarantee NO duplicates appear 2 times
  const uniqueItems: { label: string; text: string }[] = [];
  const finalSeenLabels = new Set<string>();
  const finalSeenTexts = new Set<string>();

  for (const item of items) {
    const normText = item.text.trim().toLowerCase();
    if (finalSeenLabels.has(item.label) || finalSeenTexts.has(normText)) {
      continue;
    }
    finalSeenLabels.add(item.label);
    finalSeenTexts.add(normText);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

// Extract hostname or concise domain label from URL
function getDomainLabel(rawUrl?: string): string {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || '';
  }
}

export function ClaudeToolCall({
  toolExecution,
  messageId,
  tinyfishStream,
  onRunTinyfish,
  onToggleTodo,
  onAddCandidateTask,
  addedCandidateTasks = {},
  onSelectAnalysisMode,
  savePatternMapToHistory,
}: ClaudeToolCallProps) {
  // Logs are hidden by default, exactly like Claude
  const [isOpen, setIsOpen] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [inputPhone, setInputPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingRetry, setIsSubmittingRetry] = useState(false);

  const toolType = toolExecution.tool;
  const data = toolExecution.data || {};
  const targetUrl = (data.url as string) || (data.eventUrl as string) || tinyfishStream?.targetUrl || '';

  const isTinyfish = toolType === 'tinyfish';
  const outcome = tinyfishStream?.outcome || data?.result || data?.outcome;

  const isSoldOut = isTinyfish && Boolean(
    outcome?.status === 'CLASS_FULL' ||
    outcome?.category === 'sold_out' ||
    outcome?.isSoldOut === true ||
    (typeof outcome?.summary === 'string' && /sold\s*out|fully\s*booked|class\s*full|sales\s*ended|registration\s*(is\s*)?closed|event\s*(has\s*)?(already\s*)?ended|event\s*has\s*passed/i.test(outcome.summary)) ||
    (typeof outcome?.message === 'string' && /sold\s*out|fully\s*booked|class\s*full|sales\s*ended|registration\s*(is\s*)?closed|event\s*(has\s*)?(already\s*)?ended|event\s*has\s*passed/i.test(outcome.message))
  );

  const isNeedsInput = isTinyfish && !isSoldOut && Boolean(
    tinyfishStream?.status === 'needs_input' ||
    outcome?.status === 'LOGIN_REQUIRED' ||
    outcome?.status === 'MISSING_DATA' ||
    outcome?.category === 'login_missing' ||
    outcome?.category === 'data_missing'
  );
  const isRunning = isTinyfish
    ? tinyfishStream?.status === 'running'
    : toolExecution.status === 'running';
  const isSuccess = !isNeedsInput && !isRunning && (isTinyfish
    ? (tinyfishStream?.status === 'success' || Boolean(outcome?.confirmed) || isSoldOut)
    : toolExecution.status === 'success');
  const isFailed = !isNeedsInput && !isRunning && !isSuccess && !isSoldOut && (isTinyfish
    ? tinyfishStream?.status === 'failed'
    : toolExecution.status === 'failed');

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  React.useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isRunning) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const handleProvideDetailsAndRetry = async () => {
    setIsSubmittingRetry(true);
    try {
      const customAnswers: Record<string, string> = {};
      if (inputUsername.trim()) {
        customAnswers['username'] = inputUsername.trim();
        customAnswers['user_id'] = inputUsername.trim();
        customAnswers['login_id'] = inputUsername.trim();
        customAnswers['login_email'] = inputUsername.trim();
      }
      if (inputPassword.trim()) {
        customAnswers['account_password'] = inputPassword.trim();
        customAnswers['password'] = inputPassword.trim();
      }
      const phone = inputPhone.trim();

      await fetch('/api/agent/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone || undefined,
          customAnswers: Object.keys(customAnswers).length > 0 ? customAnswers : undefined,
        }),
      });

      if (onRunTinyfish) {
        onRunTinyfish({
          url: targetUrl,
          eventUrl: targetUrl,
          goal: data.goal,
          prompt: data.prompt,
          taskType: data.taskType,
          customAnswers,
          phone,
        });
      }
    } catch (err) {
      console.error('Failed to save details and retry:', err);
    } finally {
      setIsSubmittingRetry(false);
    }
  };

  // Determine tool icon and human-readable title in General English
  let toolIcon = <Wrench size={13} />;
  let englishTitle = 'Used tool';
  let contextSnippet = '';

  switch (toolType) {
    case 'tinyfish': {
      toolIcon = <Globe size={13} />;
      const domain = getDomainLabel(data.url || data.eventUrl || tinyfishStream?.targetUrl);
      contextSnippet = domain;

      if (isRunning) {
        englishTitle = domain ? `Checking registration on ${domain}...` : 'Checking registration...';
      } else if (isSoldOut) {
        englishTitle = domain ? `Checked registration on ${domain}` : 'Checked registration';
      } else if (isNeedsInput) {
        englishTitle = domain ? `Details needed for ${domain}` : 'Additional details needed';
      } else if (outcome?.confirmed || tinyfishStream?.status === 'success') {
        englishTitle = domain ? `Registered via ${domain}` : 'Registration completed';
      } else {
        englishTitle = domain ? `Checked ${domain}` : 'Checked registration';
      }
      break;
    }
    case 'journal_analysis': {
      toolIcon = <Brain size={13} />;
      englishTitle = isRunning ? 'Synthesizing reflections...' : 'Synthesized reflections';
      const dates = Array.isArray(data.dates) ? data.dates.join(' & ') : '';
      contextSnippet = dates || 'Cognition Engine';
      break;
    }
    case 'pattern_map_result': {
      toolIcon = <Compass size={13} />;
      englishTitle = isRunning ? 'Generating Pattern Map...' : 'Generated Pattern Map';
      contextSnippet = data.sentimentScore ? `${data.sentimentScore}/100 score` : 'Atlas synthesis';
      break;
    }
    case 'voice_analysis_result': {
      toolIcon = <Mic size={13} />;
      englishTitle = isRunning ? 'Analyzing voice notes...' : 'Analyzed voice reflections';
      contextSnippet = data.speechCadenceWPM ? `${data.speechCadenceWPM} WPM` : 'Acoustic signals';
      break;
    }
    case 'memory_query':
    case 'memory_search_result': {
      toolIcon = <Search size={13} />;
      englishTitle = isRunning ? 'Searching memory trail...' : 'Searched memory trail';
      contextSnippet = data.query ? `"${data.query}"` : '';
      break;
    }
    case 'todo_list': {
      toolIcon = <ListTodo size={13} />;
      const count = Array.isArray(data.todos) ? data.todos.length : 0;
      englishTitle = 'Retrieved active tasks';
      contextSnippet = `${count} task${count === 1 ? '' : 's'}`;
      break;
    }
    case 'journal_created': {
      toolIcon = <BookOpen size={13} />;
      englishTitle = 'Recorded journal entry';
      contextSnippet = data.title || '';
      break;
    }
    case 'user_stats': {
      toolIcon = <BarChart3 size={13} />;
      englishTitle = 'Retrieved reflection momentum';
      contextSnippet = data.streakDays ? `${data.streakDays}d streak` : '';
      break;
    }
    case 'task_generation': {
      toolIcon = <CheckSquare size={13} />;
      englishTitle = 'Created new task';
      contextSnippet = data.title || '';
      break;
    }
    case 'analysis_mode_selection': {
      toolIcon = <Layers size={13} />;
      englishTitle = 'Prepared analysis options';
      contextSnippet = data.isTextOnly ? 'Text reflections' : 'Audio detected';
      break;
    }
    case 'reflective_synthesis': {
      toolIcon = <Sparkles size={13} />;
      englishTitle = 'Identified reflective pattern';
      break;
    }
    case 'user_location': {
      toolIcon = <MapPin size={13} />;
      englishTitle = data?.latitude ? 'Verified physical location' : 'Location access requested';
      const locArea = [data?.city, data?.region, data?.country].filter(Boolean).join(', ');
      contextSnippet = locArea || (data?.latitude ? `${data.latitude.toFixed(2)}°, ${data.longitude.toFixed(2)}°` : 'Permission Needed');
      break;
    }
    case 'web_search': {
      toolIcon = <Globe size={13} />;
      englishTitle = isRunning ? 'Searching live web...' : 'Searched the web';
      contextSnippet = data.query ? `"${data.query}"` : '';
      break;
    }
    default: {
      englishTitle = toolExecution.title || `Used ${toolType.replace(/_/g, ' ')}`;
      break;
    }
  }

  return (
    <div className="my-2 ml-7 overflow-hidden rounded-xl border border-[#DFDAD2] bg-[#F3F0EB] text-[#44403C] shadow-2xs transition-all">
      {/* ── Claude-style Minimalist Grey Tool Bar (Click to toggle) ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3.5 py-2 text-left hover:bg-[#EBE7E1] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          {/* Subtle Icon Badge */}
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-[#E6E1D8] text-[#5C554D]">
            {toolIcon}
          </div>

          {/* Action Title in Plain English */}
          <div className="flex items-center gap-2 truncate text-xs">
            <span className="font-medium text-[#2E2823]">
              {englishTitle}
            </span>

            {/* Context Snippet Pill */}
            {contextSnippet && (
              <span className="rounded bg-[#E7E2D9] px-1.5 py-0.5 text-[11px] font-mono text-[#6B6357] truncate max-w-[220px] sm:max-w-xs">
                {contextSnippet}
              </span>
            )}
          </div>
        </div>

        {/* Status Indicator & Expand Chevron */}
        <div className="flex items-center gap-2 text-xs flex-shrink-0">
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#8F4D30]">
              <Loader2 size={12} className="animate-spin text-[#8F4D30]" />
              <span>Checking</span>
              <span className="font-mono text-[10px] bg-[#E5DFD5] px-1.5 py-0.2 rounded text-[#78716C]">
                {elapsedSeconds}s
              </span>
            </span>
          ) : isSoldOut ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
              <AlertCircle size={11} className="text-amber-700" />
              Sold Out
            </span>
          ) : isNeedsInput ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
              <Lock size={11} className="text-amber-700" />
              Details Needed
            </span>
          ) : isSuccess && outcome?.confirmed ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200">
              <Check size={11} className="text-emerald-700" />
              Confirmed
            </span>
          ) : isSuccess ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#566B44]">
              {data.durationMs ? (
                <span className="font-mono text-[10px] bg-[#E7E2D9] px-1.5 py-0.5 rounded text-[#5C554D]">
                  {(data.durationMs / 1000).toFixed(1)}s
                </span>
              ) : null}
              <Check size={12} />
              Done
            </span>
          ) : isFailed ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#78716C]">
              Completed
            </span>
          ) : null}

          {/* Chevron rotates smoothly */}
          <ChevronDown
            size={14}
            className={`text-[#78716C] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* ── Expanded Content (Shown ONLY when clicked, in 100% General English) ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-[#DFDAD2] bg-[#FAF8F5] p-4 text-xs text-[#3D3730] space-y-3.5"
          >
            {/* Claude Step Reasoning / Textual Context Callout */}
            {(toolExecution.narrative || (data?.narrative && typeof data.narrative === 'string')) && (
              <div className="rounded-xl bg-white border border-[#E6DFD5] p-3 text-[12px] text-[#44403C] leading-relaxed flex items-start gap-2.5 shadow-2xs">
                <Sparkles size={13} className="text-[#8f4d30] flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[10px] font-semibold text-[#8f4d30] uppercase tracking-wider block">Context & Objective</span>
                  <p className="text-[#3D3730]">{toolExecution.narrative || data.narrative}</p>
                </div>
              </div>
            )}

            {/* ── TINYFISH BROWSER AUTOMATION DETAILS ── */}
            {toolType === 'tinyfish' && (
              <div className="space-y-3">
                {/* Target Webpage Row */}
                {targetUrl && (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3.5 py-2.5 border border-[#E6DFD5] shadow-2xs">
                    <div className="flex items-center gap-2 truncate text-xs text-[#5C3E21]">
                      <Globe size={13} className="text-[#8f4d30] flex-shrink-0" />
                      <span className="truncate font-mono text-[11px] text-[#2E2012]">{targetUrl}</span>
                    </div>
                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8f4d30] hover:underline flex-shrink-0"
                    >
                      Visit page <ExternalLink size={10} />
                    </a>
                  </div>
                )}

                {/* Sold Out Notification Card */}
                {isSoldOut && (
                  <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 p-3.5 space-y-2 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                        <AlertCircle size={15} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-xs text-amber-950">
                            {/sales\s*ended|registration\s*(is\s*)?closed|event\s*(has\s*)?(already\s*)?ended|event\s*has\s*passed/i.test(outcome?.summary || outcome?.message || '') ? 'Registration Has Ended' : 'Tickets Are Currently Sold Out'}
                          </h4>
                          <span className="rounded-full bg-amber-200/70 px-2 py-0.2 text-[10px] font-medium text-amber-900">
                            {/sales\s*ended/i.test(outcome?.summary || outcome?.message || '') ? 'Sales Ended' : /event\s*(has\s*)?(already\s*)?ended|event\s*has\s*passed/i.test(outcome?.summary || outcome?.message || '') ? 'Event Passed' : 'Fully Booked'}
                          </span>
                        </div>
                        <p className="text-[12px] text-amber-900/90 leading-relaxed">
                          {outcome?.summary ||
                            `This event on ${getDomainLabel(targetUrl) || 'the ticketing page'} is fully booked with no open ticket slots available.`}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Registration Confirmed Card */}
                {outcome?.confirmed && !isSoldOut && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 space-y-2 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                        <CheckCircle2 size={15} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-xs text-emerald-950">
                          Registration Confirmed
                        </h4>
                        <p className="text-[12px] text-emerald-900/90 leading-relaxed">
                          {outcome?.summary || 'Your registration has been successfully confirmed.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Interactive Needs-Input / Login Required Card */}
                {isNeedsInput && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-3 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                        <Lock size={13} />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="font-semibold text-xs text-amber-950">
                          Account Sign-In or Contact Info Needed
                        </h4>
                        <p className="text-[11px] text-amber-900 leading-relaxed">
                          {tinyfishStream?.outcome?.summary ||
                            tinyfishStream?.outcome?.reason ||
                            `${getDomainLabel(targetUrl)} requires an account password or phone number to finalize your booking.`}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-amber-200/70">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-medium text-amber-900 uppercase tracking-wider block mb-1">
                            User ID / Username / Email
                          </label>
                          <input
                            type="text"
                            value={inputUsername}
                            onChange={(e) => setInputUsername(e.target.value)}
                            placeholder="e.g. srinjoy or your email"
                            className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#8f4d30] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-medium text-amber-900 uppercase tracking-wider block mb-1">
                            Account Password / Login Key
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={inputPassword}
                              onChange={(e) => setInputPassword(e.target.value)}
                              placeholder="Enter account password"
                              className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 pr-8 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#8f4d30] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563]"
                            >
                              {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-medium text-amber-900 uppercase tracking-wider block mb-1">
                            Mobile Phone Number
                          </label>
                          <input
                            type="tel"
                            value={inputPhone}
                            onChange={(e) => setInputPhone(e.target.value)}
                            placeholder="e.g. +91 98765 43210"
                            className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-[#1F2937] placeholder-[#9CA3AF] focus:border-[#8f4d30] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          disabled={isSubmittingRetry || (!inputPassword.trim() && !inputUsername.trim() && !inputPhone.trim())}
                          onClick={handleProvideDetailsAndRetry}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#8f4d30] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#723c24] disabled:opacity-50 transition-all cursor-pointer shadow-2xs"
                        >
                          {isSubmittingRetry ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              <span>Logging in & Booking...</span>
                            </>
                          ) : (
                            <>
                              <ArrowRight size={12} />
                              <span>Log In & Book Class</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Automation Progress Timeline & Sequential Steps */}
                <div className="rounded-xl bg-white p-3 border border-[#E6DFD5] space-y-2.5">
                  <div className="font-medium text-xs text-[#2E2012] flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold text-[#2E2012]">
                      <Globe size={13} className="text-[#8f4d30]" />
                      <span>Automation Timeline</span>
                    </span>
                    <span className="text-[11px] font-normal text-[#7A5A3A]">
                      {isRunning
                        ? 'In progress'
                        : isSoldOut
                        ? 'Checked availability'
                        : isNeedsInput
                        ? 'Waiting for info'
                        : 'Done'}
                    </span>
                  </div>

                  <div className="space-y-2 pt-1 text-xs text-[#5C3E21]">
                    {tinyfishStream?.steps && tinyfishStream.steps.length > 0 ? (
                      tinyfishStream.steps.map((stepText, idx) => {
                        const isLast = idx === tinyfishStream.steps!.length - 1;
                        const isStepRunning = isRunning && isLast;
                        const isStepComplete = !isStepRunning && !isNeedsInput;

                        return (
                          <div key={idx} className="flex items-start gap-2.5">
                            <div className="mt-0.5 flex-shrink-0">
                              {isStepRunning ? (
                                <Loader2 size={12} className="animate-spin text-[#8f4d30]" />
                              ) : isStepComplete ? (
                                <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                  <Check size={9} strokeWidth={3} />
                                </div>
                              ) : isNeedsInput && isLast ? (
                                <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                                  <Lock size={9} />
                                </div>
                              ) : (
                                <div className="h-1.5 w-1.5 rounded-full bg-[#8f4d30] mt-1 ml-1" />
                              )}
                            </div>
                            <span className={`text-[12px] leading-snug ${isLast ? 'font-medium text-[#2E2012]' : 'text-[#7A5A3A]'}`}>
                              {stepText}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <Check size={9} strokeWidth={3} />
                          </div>
                          <span>Navigated to <strong>{getDomainLabel(targetUrl) || 'event page'}</strong></span>
                        </div>
                        {tinyfishStream?.currentAction && (
                          <div className="flex items-center gap-2">
                            {isRunning ? (
                              <Loader2 size={12} className="animate-spin text-[#8f4d30]" />
                            ) : (
                              <div className={`h-1.5 w-1.5 rounded-full ${isSoldOut ? 'bg-amber-600' : 'bg-[#8f4d30]'}`} />
                            )}
                            <span className="font-medium text-[#2E2012]">{tinyfishStream.currentAction}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Formatted Human-readable Event Outcome (if details exist and not sold out) */}
                {outcome && !isSoldOut && renderGeneralEnglishOutcome(outcome).length > 0 && (
                  <div className="rounded-xl bg-white p-3 border border-[#E6DFD5] space-y-2">
                    <span className="font-medium text-xs text-[#2E2012] block">
                      Booking Information
                    </span>
                    <div className="space-y-1.5 text-xs">
                      {renderGeneralEnglishOutcome(outcome).map((item, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-3 py-1 border-b border-[#F0EDE8] last:border-0">
                          <span className="text-[#7A5A3A]">{item.label}</span>
                          <span className="text-[#2E2012] text-right font-medium">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional Live Browser View Toggle */}
                {tinyfishStream?.streamingUrl && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowLivePreview(!showLivePreview)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#78716C] hover:text-[#2E2823] transition-colors cursor-pointer"
                    >
                      {showLivePreview ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{showLivePreview ? 'Hide live browser session' : 'View live browser session'}</span>
                    </button>

                    {showLivePreview && (
                      <div className="mt-2 h-72 w-full overflow-hidden rounded-xl border border-[#DFDAD2] bg-[#EAE6DF]">
                        <iframe
                          src={tinyfishStream.streamingUrl}
                          className="h-full w-full border-0"
                          title="Live Browser Stream"
                          allow="camera; microphone; display-capture"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Launch Trigger if idle */}
                {(!tinyfishStream || tinyfishStream.status === 'idle') && onRunTinyfish && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        onRunTinyfish({
                          url: targetUrl,
                          eventUrl: targetUrl,
                          goal: data.goal,
                          prompt: data.prompt,
                          taskType: data.taskType,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#8F4D30] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#723C24] transition-all cursor-pointer shadow-xs"
                    >
                      <span>Start Browser Agent</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── LIVE WEB SEARCH RESULTS (Firecrawl / Web) ── */}
            {toolType === 'web_search' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#2E2823]">
                      {Array.isArray(data.results) ? `${data.results.length} Web Results` : 'Web Results'}
                    </span>
                    {data.provider && (
                      <span className="rounded bg-[#E7E2D9] px-1.5 py-0.5 text-[10px] font-mono uppercase text-[#78716C]">
                        {data.provider === 'firecrawl' ? 'Firecrawl API' : 'Live Web'}
                      </span>
                    )}
                  </div>
                  {data.durationMs && (
                    <span className="text-[11px] font-mono text-[#78716C]">
                      {(data.durationMs / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>

                {Array.isArray(data.results) && data.results.length > 0 ? (
                  <div className="space-y-2">
                    {data.results.map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="rounded-lg bg-[#FAF8F5] p-3 border border-[#E6E1D8] space-y-1.5 hover:border-[#8F4D30]/40 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-xs text-[#8F4D30] hover:underline flex items-center gap-1 line-clamp-1"
                          >
                            <span>{item.title}</span>
                            <ExternalLink size={10} className="flex-shrink-0" />
                          </a>
                          {onRunTinyfish && item.url && (
                            <button
                              type="button"
                              onClick={() =>
                                onRunTinyfish({
                                  url: item.url,
                                  prompt: `Register for ${item.title}`,
                                  taskType: 'registration',
                                })
                              }
                              className="flex-shrink-0 text-[10px] font-medium text-[#8F4D30] hover:bg-[#8F4D30]/10 px-2 py-0.5 rounded border border-[#8F4D30]/30 transition-all cursor-pointer"
                            >
                              Register Online →
                            </button>
                          )}
                        </div>
                        {item.snippet && (
                          <p className="text-[11px] text-[#5C554D] leading-relaxed line-clamp-2">
                            {item.snippet}
                          </p>
                        )}
                        <div className="text-[10px] font-mono text-[#8C8275] truncate">
                          {getDomainLabel(item.url)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#78716C]">No direct results found for this search.</p>
                )}
              </div>
            )}

            {/* ── COGNITION ENGINE / JOURNAL ANALYSIS ── */}
            {toolType === 'journal_analysis' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-2 text-xs">
                  <span className="font-medium text-[#2E2823]">
                    {data.dates?.join(' & ') || 'Reflections Analyzed'}
                  </span>
                  <Link
                    href="/analysis"
                    className="inline-flex items-center gap-1 font-medium text-[#8F4D30] hover:underline"
                  >
                    Open Analysis <ExternalLink size={10} />
                  </Link>
                </div>

                {data.emotionalShift && (
                  <div className="rounded-lg bg-white p-2.5 border border-[#E5E0D8]">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#78716C] block mb-0.5">
                      Emotional Trajectory
                    </span>
                    <p className="text-xs text-[#2E2823] leading-relaxed">
                      {data.emotionalShift}
                    </p>
                  </div>
                )}

                {Array.isArray(data.insights) && data.insights.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#78716C] block">
                      Core Observations
                    </span>
                    {data.insights.map((ins: any, i: number) => (
                      <div key={i} className="rounded-lg bg-white p-2.5 border border-[#E5E0D8]">
                        <div className="font-medium text-[#2E2823]">{ins.title}</div>
                        <p className="mt-0.5 text-[#5C554D] leading-relaxed">{ins.observation}</p>
                        {ins.quote && (
                          <p className="mt-1 text-[11px] italic text-[#78716C]">"{ins.quote}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Candidate Tasks */}
                {Array.isArray(data.actionCandidates) && data.actionCandidates.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#78716C] block">
                      Actionable Priorities
                    </span>
                    {data.actionCandidates.map((cand: any, i: number) => {
                      const key = `${messageId}-cand-${i}`;
                      const added = addedCandidateTasks[key];
                      return (
                        <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-white p-2 border border-[#E5E0D8]">
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-xs text-[#2E2823] block break-words whitespace-normal [overflow-wrap:anywhere]">{cand.title}</span>
                            <span className="text-[10px] text-[#78716C] capitalize">{cand.priority} priority</span>
                          </div>
                          {onAddCandidateTask && (
                            <button
                              type="button"
                              onClick={() => onAddCandidateTask(cand, key)}
                              disabled={added}
                              className={`flex-shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                                added
                                  ? 'bg-[#E6EDE1] text-[#446633]'
                                  : 'bg-[#8F4D30] text-white hover:bg-[#723C24] cursor-pointer'
                              }`}
                            >
                              {added ? <Check size={11} /> : <Plus size={11} />}
                              <span>{added ? 'Added' : 'Add to List'}</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── PATTERN MAP RESULT ── */}
            {toolType === 'pattern_map_result' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-2 text-xs">
                  <span className="font-medium text-[#2E2823]">
                    Pattern Score: {data.sentimentScore || 78}/100
                  </span>
                  <Link
                    href={`/analysis/advanced?id=${encodeURIComponent(data.historyId || '')}&open=latest`}
                    onClick={() => {
                      if (data.historyId) {
                        localStorage.setItem('advancedAnalysisActiveId', data.historyId);
                      } else if (savePatternMapToHistory) {
                        const savedId = savePatternMapToHistory(data, toolExecution.title);
                        if (savedId) localStorage.setItem('advancedAnalysisActiveId', savedId);
                      }
                    }}
                    className="inline-flex items-center gap-1 font-medium text-[#8F4D30] hover:underline"
                  >
                    Open Full Atlas <ExternalLink size={10} />
                  </Link>
                </div>

                {data.weeklyInsight && (
                  <div className="rounded-lg bg-white p-3 border border-[#E5E0D8]">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#78716C] block mb-1">
                      💡 Takeaway
                    </span>
                    <p className="text-xs text-[#2E2823] leading-relaxed">
                      {data.weeklyInsight}
                    </p>
                  </div>
                )}

                {data.growthEdge && (
                  <div className="rounded-lg bg-white p-3 border border-[#E5E0D8]">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#8F4D30] block mb-1">
                      🌱 Growth Edge
                    </span>
                    <p className="text-xs text-[#2E2823] leading-relaxed">
                      {data.growthEdge}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── MEMORY SEARCH RESULT ── */}
            {(toolType === 'memory_search_result' || (toolType === 'memory_query' && data.memories)) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-2 text-xs">
                  <span className="font-medium text-[#2E2823]">
                    Search Query: "{data.query || 'memory'}"
                  </span>
                  <span className="text-[11px] text-[#78716C]">
                    {Array.isArray(data.memories) ? data.memories.length : 0} entries recalled
                  </span>
                </div>

                {data.answer && (
                  <div className="rounded-lg bg-white p-3 border border-[#E5E0D8]">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#78716C] block mb-1">
                      Recollection Synthesis
                    </span>
                    <p className="text-xs text-[#2E2823] leading-relaxed">
                      {data.answer}
                    </p>
                  </div>
                )}

                {Array.isArray(data.memories) && data.memories.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[#78716C] block">
                      Referenced Reflections
                    </span>
                    {data.memories.map((mem: any, idx: number) => (
                      <div key={idx} className="rounded-lg bg-white p-2.5 border border-[#E5E0D8]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <Link
                            href={`/journal/${mem.journalId}`}
                            className="font-medium text-xs text-[#2E2823] hover:text-[#8F4D30] hover:underline flex items-center gap-1 truncate"
                          >
                            <BookOpen size={11} className="text-[#8F4D30]" />
                            <span className="truncate">{mem.title || 'Journal Entry'}</span>
                          </Link>
                          {mem.date && (
                            <span className="text-[10px] text-[#78716C] flex-shrink-0">
                              {mem.date.slice(0, 10)}
                            </span>
                          )}
                        </div>
                        {mem.highlight && (
                          <p className="text-[11px] italic text-[#5C554D] border-l-2 border-[#8F4D30]/40 pl-2 mt-1">
                            "{mem.highlight}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TO-DO LIST ── */}
            {toolType === 'todo_list' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-2 text-xs">
                  <span className="font-medium text-[#2E2823]">Active Tasks</span>
                  <Link href="/todo" className="font-medium text-[#8F4D30] hover:underline">
                    Open To-Do →
                  </Link>
                </div>

                {Array.isArray(data.todos) && data.todos.length > 0 ? (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {data.todos.map((todo: any, idx: number) => {
                      const isDone = todo.status === 'done';
                      return (
                        <div
                          key={todo.id || idx}
                          onClick={() => onToggleTodo && onToggleTodo(todo.id, todo.status)}
                          className={`flex items-center justify-between gap-2 rounded-lg p-2 border cursor-pointer transition-all ${
                            isDone
                              ? 'bg-[#EFECE6] border-[#DFDAD2] text-[#8C857B] line-through'
                              : 'bg-white border-[#E5E0D8] text-[#2E2823] hover:border-[#8F4D30]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isDone ? (
                              <CheckSquare size={13} className="text-[#566B44] flex-shrink-0" />
                            ) : (
                              <Square size={13} className="text-[#A8A196] flex-shrink-0" />
                            )}
                            <span className="truncate text-xs font-medium">{todo.title}</span>
                          </div>
                          <span className="text-[10px] uppercase font-mono text-[#78716C] flex-shrink-0">
                            {todo.priority || 'medium'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[#78716C] py-2">No active tasks found.</p>
                )}
              </div>
            )}

            {/* ── USER STATS OVERVIEW ── */}
            {toolType === 'user_stats' && (
              <div className="space-y-2.5">
                <span className="font-medium text-xs text-[#2E2823] block border-b border-[#E5E0D8] pb-1.5">
                  Reflection Overview
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-white p-2 border border-[#E5E0D8]">
                    <div className="text-[10px] text-[#78716C]">Streak</div>
                    <div className="font-semibold text-sm text-[#8F4D30]">{data.streakDays || 0}d</div>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-[#E5E0D8]">
                    <div className="text-[10px] text-[#78716C]">Reflections</div>
                    <div className="font-semibold text-sm text-[#2E2823]">{data.journalCount || 0}</div>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-[#E5E0D8]">
                    <div className="text-[10px] text-[#78716C]">Tasks</div>
                    <div className="font-semibold text-sm text-[#2E2823]">{data.activeTodosCount || 0}</div>
                  </div>
                  <div className="rounded-lg bg-white p-2 border border-[#E5E0D8]">
                    <div className="text-[10px] text-[#78716C]">Momentum</div>
                    <div className="font-semibold text-sm text-[#566B44]">{data.momentumScore || 80}/100</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── ANALYSIS MODE SELECTION ── */}
            {toolType === 'analysis_mode_selection' && (
              <div className="space-y-3">
                <span className="font-medium text-xs text-[#2E2823] block border-b border-[#E5E0D8] pb-1.5">
                  Available Analysis Engines
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectAnalysisMode && onSelectAnalysisMode('cognition_engine', data.targetDates || data.dates)}
                    className="flex flex-col items-start rounded-lg border border-[#E5E0D8] bg-white p-3 text-left hover:border-[#8F4D30] transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-xs text-[#2E2823]">Cognition Engine</span>
                    <p className="mt-1 text-[11px] text-[#5C554D] leading-relaxed">
                      Narrative trajectory, core insights, and grounded to-dos.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectAnalysisMode && onSelectAnalysisMode('pattern_map', data.targetDates || data.dates)}
                    className="flex flex-col items-start rounded-lg border border-[#E5E0D8] bg-white p-3 text-left hover:border-[#8F4D30] transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-xs text-[#2E2823]">Pattern Map</span>
                    <p className="mt-1 text-[11px] text-[#5C554D] leading-relaxed">
                      Holistic life patterns, growth edge, and cognitive flow clusters.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* ── USER LOCATION CARD ── */}
            {toolType === 'user_location' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-1.5">
                  <span className="font-medium text-xs text-[#2E2823] flex items-center gap-1.5">
                    <MapPin size={13} className="text-emerald-700" />
                    <span>Your Location</span>
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${data?.latitude ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {data?.latitude ? 'Verified' : 'Access Needed'}
                  </span>
                </div>

                {data?.latitude ? (
                  <div className="rounded-xl bg-white p-3.5 border border-[#E6DFD5] space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-[#A68664] block">City / Area</span>
                        <span className="font-medium text-sm text-[#2E2012]">
                          {[data.city, data.region, data.country].filter(Boolean).join(', ') || 'Local Area'}
                        </span>
                      </div>
                      {data.timezone && (
                        <span className="rounded-full bg-[#FAF7F2] px-2.5 py-1 text-[11px] text-[#7A5A3A] border border-[#E6DFD5]">
                          {data.timezone}
                        </span>
                      )}
                    </div>
                    {data.formattedAddress && (
                      <p className="text-xs text-[#5C3E21] leading-relaxed pt-1.5 border-t border-[#F0EDE8]">
                        {data.formattedAddress}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-amber-50/70 p-3 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                    Location access has not been granted yet. Click the <strong>&ldquo;Enable Location&rdquo;</strong> button in the top header to share your live coordinates with Force Agent.
                  </div>
                )}
              </div>
            )}

            {/* ── GENERIC TOOL DETAILS FALLBACK ── */}
            {!['tinyfish', 'journal_analysis', 'pattern_map_result', 'memory_search_result', 'memory_query', 'todo_list', 'user_stats', 'analysis_mode_selection', 'user_location'].includes(toolType) && (
              <div className="space-y-2">
                <div className="font-medium text-xs text-[#2E2823]">
                  {toolExecution.title || 'Tool Details'}
                </div>
                {toolExecution.message && (
                  <p className="text-xs text-[#524B43] leading-relaxed">{toolExecution.message}</p>
                )}
                {Object.keys(data).length > 0 && (
                  <div className="rounded-lg bg-white p-2.5 border border-[#E5E0D8] space-y-1">
                    {renderGeneralEnglishOutcome(data).map((item, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 py-0.5 text-xs">
                        <span className="font-medium text-[#5C554D]">{item.label}:</span>
                        <span className="text-[#2E2823]">{item.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
