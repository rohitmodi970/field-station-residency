'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Brain, Sparkles, ListChecks, MessageSquare, Clock3, ChevronLeft, ChevronRight, Mic, MicOff, Check, ArrowUpRight } from 'lucide-react';
import { announceTaskAdded } from '@/utils/notifications/taskAddedNotifier';
import { useAiDecryption } from '@/utils/encryption/useAiDecryption';

type Mode = 'planning' | 'communication' | 'decision' | 'execution' | 'reset';

type LifeArea = 'work' | 'relationship' | 'family' | 'self' | 'health';

type Insight = {
  core: string;
  tension: string;
};

type Question = {
  id: string;
  question: string;
};

type RebalanceOption = 'reset' | 'move' | 'reach_out' | 'sit_with';

type CognitionSection = {
  whatIUnderstanding?: string;
  whereYourMindGoing?: string;
  rebalanceChoice?: RebalanceOption;
  rebalanceNotes?: string;
  closingReflection?: string;
};

type AnalyzeResponse = {
  insight: Insight;
  questions: Question[];
  mode?: Mode;
  lifeAreas?: LifeArea[];
  summary?: string;
};

type SavedCognitionSession = {
  id: string;
  journal_id?: string | null;
  insight_core?: string | null;
  insight_tension?: string | null;
  mode?: Mode | null;
  life_areas?: LifeArea[] | null;
  analysis_snapshot?: {
    insight?: Insight;
    questions?: Question[];
    mode?: Mode;
    lifeAreas?: LifeArea[];
  } | null;
  question_responses?: Array<{ id: string; question: string; answer: string }> | null;
  generated_tasks?: GeneratedTask[] | null;
  output_state?: {
    currentQuestionIndex?: number;
    showThinking?: boolean;
    createdCount?: number;
    selectedTaskCount?: number;
    whatIUnderstanding?: string;
    summarySections?: {
      emotional_landscape?: string[];
      core_tensions?: string[];
      patterns_noticed?: string[];
      reflection_prompts?: string[];
      gentle_suggestions?: string[];
    } | null;
    whereYourMindGoing?: string;
    rebalanceChoice?: RebalanceOption;
    rebalanceNotes?: string;
    rebalanceTaskDeadline?: string;
    closingReflection?: string;
    currentSectionIndex?: number;
    directionalChoice?: 'think' | 'rebalance' | 'both' | null;
    pastOrientation?: boolean;
  } | null;
  entry_text?: string | null;
  priority?: 'high' | 'medium' | 'low' | null;
  created_at?: string;
  updated_at?: string;
};

type GeneratedTask = {
  title: string;
  description?: string;
  subtasks: string[];
  estimated_time: string;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  suggested_deadline?: string;
  allocation?: 'focus_today' | 'also_today' | 'space_for_later';
  reasoning?: string;
};

function formatForDateTimeLocal(isoString?: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

type RebalanceTaskPreview = {
  task: GeneratedTask;
  needsRefinement: boolean;
  helperText: string;
};

const loadedCognitionSessionJournalIds = new Set<string>();

type Props = {
  entryText: string;
  journalId?: string | null;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
};

const LIFE_AREA_LABELS: Record<LifeArea, string> = {
  work: 'Work',
  relationship: 'Relationship',
  family: 'Family',
  self: 'Self',
  health: 'Health',
};

const LIFE_AREA_COLORS: Record<LifeArea, string> = {
  work: 'bg-blue-100 text-blue-700 border-blue-200',
  relationship: 'bg-rose-100 text-rose-700 border-rose-200',
  family: 'bg-amber-100 text-amber-700 border-amber-200',
  self: 'bg-purple-100 text-purple-700 border-purple-200',
  health: 'bg-green-100 text-green-700 border-green-200',
};

const REBALANCE_PROMPTS: Record<RebalanceOption, string> = {
  reset: 'What would help you feel more grounded right now?',
  move: 'What is one small step you can take right now?',
  reach_out: 'Who would you like to talk to or reach out to?',
  sit_with: 'What do you want to think through more clearly?',
};

const REBALANCE_OPTION_LABELS: Record<RebalanceOption, string> = {
  reset: 'Reset myself',
  move: 'Move something forward',
  reach_out: 'Reach out to someone',
  sit_with: 'Sit with this and think it through',
};

const REBALANCE_OPTION_SHIFTS: Record<RebalanceOption, string> = {
  reset: 'shift toward grounding',
  move: 'shift toward motion',
  reach_out: 'shift toward connection',
  sit_with: 'shift toward clarity',
};

const REBALANCE_DEFAULT_TASKS: Record<RebalanceOption, GeneratedTask> = {
  reset: {
    title: 'Reset and ground yourself',
    subtasks: ['Pause for a few slow breaths', 'Notice what helps you settle'],
    estimated_time: '10m',
    priority: 'medium',
  },
  move: {
    title: 'Move one small thing forward',
    subtasks: ['Pick the smallest next step', 'Do it for 15-20 minutes'],
    estimated_time: '20m',
    priority: 'medium',
  },
  reach_out: {
    title: 'Reach out to someone safe',
    subtasks: ['Choose one person', 'Send a short, honest check-in'],
    estimated_time: '15m',
    priority: 'medium',
  },
  sit_with: {
    title: 'Sit with it and think it through',
    subtasks: ['Set aside a quiet stretch of time', 'Write down what feels unclear'],
    estimated_time: '20m',
    priority: 'medium',
  },
};

const VAGUE_REBALANCE_INPUT = /^(?:maybe|something|anything|stuff|later|idk|i don't know|not sure|figure it out|fix it|better|help me)$/i;

function capitalizeTaskTitle(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function stripRebalanceFiller(text: string): string {
  return text
    .replace(/^i\s+(?:want|wanna|need|should|could|would|plan to|am going to|will)\s+/i, '')
    .replace(/^to\s+/i, '')
    .replace(/^just\s+/i, '')
    .replace(/^maybe\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitRebalanceFragments(text: string): string[] {
  return text
    .split(/,|;|\band\b|\bthen\b/gi)
    .map((fragment) => stripRebalanceFiller(fragment))
    .filter(Boolean)
    .slice(0, 2);
}

function detectEstimatedTime(text: string, fallback: string): string {
  const normalized = text.toLowerCase();
  const timeMatch = normalized.match(/(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)\b/);
  if (timeMatch) {
    const amount = Number.parseInt(timeMatch[1] || '', 10);
    if (!Number.isNaN(amount) && amount > 0) {
      return (timeMatch[2] || '').startsWith('h') ? `${amount}h` : `${amount}m`;
    }
  }

  return fallback;
}

function buildRebalanceTaskPreview(choice: RebalanceOption | null, notes: string): RebalanceTaskPreview | null {
  if (!choice) return null;

  const trimmedNotes = notes.trim();
  const defaultTask = REBALANCE_DEFAULT_TASKS[choice];

  if (!trimmedNotes) {
    return {
      task: defaultTask,
      needsRefinement: false,
      helperText: 'No detail yet, so using a grounded default task.',
    };
  }

  const isVague = trimmedNotes.length < 12 || VAGUE_REBALANCE_INPUT.test(trimmedNotes);
  if (isVague) {
    return {
      task: defaultTask,
      needsRefinement: true,
      helperText: 'Can you make this a bit more specific so you actually do it?',
    };
  }

  const fragments = splitRebalanceFragments(trimmedNotes);
  const titleSource = stripRebalanceFiller(fragments[0] || trimmedNotes);
  const titleClause = (titleSource.split(/[.?!]/)[0] || '').split(/\bto\b/)[0] || '';
  const cleanTitle = capitalizeTaskTitle(titleClause.trim().split(' ').slice(0, 8).join(' '));
  const title = cleanTitle || defaultTask.title;

  const subtasks = fragments.length > 1
    ? fragments.map((fragment) => capitalizeTaskTitle(fragment)).filter((fragment) => fragment.toLowerCase() !== title.toLowerCase())
    : [capitalizeTaskTitle(titleSource || defaultTask.title)];

  return {
    task: {
      title,
      subtasks: subtasks.length > 0 ? subtasks.slice(0, 2) : defaultTask.subtasks,
      estimated_time: detectEstimatedTime(trimmedNotes, defaultTask.estimated_time),
      priority: defaultTask.priority,
    },
    needsRefinement: false,
    helperText: 'This is the task preview we can turn into action.',
  };
}

function buildRebalanceOutput(choice: RebalanceOption | null, notes: string, lifeAreas: LifeArea[] | undefined): { focusLine: string; shiftLine: string; actionLine: string; } | null {
  if (!choice) return null;

  const areas = Array.isArray(lifeAreas) ? lifeAreas.map((area) => LIFE_AREA_LABELS[area]).filter(Boolean) : [];
  const areaLine = areas.length > 0
    ? `You’ve been carrying a lot of attention in ${areas.slice(0, 3).join(', ')}.`
    : 'You’ve been carrying a lot of attention in one area.';

  const cleanedNotes = notes.trim();
  const actionLine = cleanedNotes
    ? `Your words point to: ${cleanedNotes}`
    : `The next move is to ${REBALANCE_OPTION_SHIFTS[choice]}.`;

  return {
    focusLine: areaLine,
    shiftLine: `This path nudges you to ${REBALANCE_OPTION_SHIFTS[choice]} instead of pushing harder on the same thread.`,
    actionLine,
  };
}

export default function CognitionEngineWorkspace({ entryText, journalId, showToast }: Props) {
  const { decryptCognition } = useAiDecryption();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [createdCount, setCreatedCount] = useState(0);
  const [showThinking, setShowThinking] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [selectedTaskKeys, setSelectedTaskKeys] = useState<Record<string, boolean>>({});
  const [taskDeadlines, setTaskDeadlines] = useState<Record<string, string | null>>({});
  const [isRecordingAnswer, setIsRecordingAnswer] = useState(false);
  const [isTranscribingAnswer, setIsTranscribingAnswer] = useState(false);
  const [speechDraft, setSpeechDraft] = useState('');
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [savedSessionData, setSavedSessionData] = useState<SavedCognitionSession | null>(null);
  const [isHydratingSession, setIsHydratingSession] = useState(false);
  
  // New section states
  const [whatIUnderstanding, setWhatIUnderstanding] = useState('');
  const [whereYourMindGoing, setWhereYourMindGoing] = useState('');
  const [rebalanceChoice, setRebalanceChoice] = useState<RebalanceOption | null>(null);
  const [rebalanceNotes, setRebalanceNotes] = useState('');
  const [rebalanceTaskDeadline, setRebalanceTaskDeadline] = useState('');
  const [closingReflection, setClosingReflection] = useState('');
  const [summarySections, setSummarySections] = useState({
    emotional_landscape: [] as string[],
    core_tensions: [] as string[],
    patterns_noticed: [] as string[],
    reflection_prompts: [] as string[],
    gentle_suggestions: [] as string[],
  });
  const [directionalChoice, setDirectionalChoice] = useState<'think' | 'rebalance' | 'both' | null>(null);
  const [pastOrientation, setPastOrientation] = useState(false);
  const [reflectPhaseDone, setReflectPhaseDone] = useState(false);
  const [rebalancePhaseDone, setRebalancePhaseDone] = useState(false);
  const loadedSessionJournalIdRef = useRef<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const normalizedEntry = useMemo(() => entryText.replace(/\s+/g, ' ').trim(), [entryText]);

  const questions = analysis?.questions || [];
  const currentQuestion = questions[currentQuestionIndex] || null;
  const isLastQuestion = Boolean(currentQuestion && currentQuestionIndex === questions.length - 1);
  const responsesReady = questions.length > 0 && questions.every((question) => (answers[question.id] || '').trim().length > 0);
  const synthesisReady = Boolean(
    analysis &&
      pastOrientation &&
      directionalChoice &&
      (directionalChoice === 'rebalance' || responsesReady)
  );
  const getTaskKey = useCallback((task: GeneratedTask, index: number): string => {
    return `${index}:${task.title.trim().toLowerCase()}`;
  }, []);

  type FlowStep = 'orient' | 'choose' | 'reflect' | 'rebalance' | 'synthesize' | 'tasks' | 'done';

  const flowStep = useMemo((): FlowStep | null => {
    if (!analysis) return null;
    if (createdCount > 0) return 'done';
    if (tasks.length > 0) return 'tasks';
    if (!pastOrientation) return 'orient';
    if (!directionalChoice) return 'choose';
    const needsReflect = directionalChoice === 'think' || directionalChoice === 'both';
    const needsRebalance = directionalChoice === 'rebalance' || directionalChoice === 'both';
    if (needsReflect && !reflectPhaseDone) return 'reflect';
    if (needsRebalance && !rebalancePhaseDone) return 'rebalance';
    if (synthesisReady) return 'synthesize';
    return 'orient';
  }, [
    analysis,
    createdCount,
    tasks.length,
    pastOrientation,
    directionalChoice,
    reflectPhaseDone,
    rebalancePhaseDone,
    synthesisReady,
  ]);

  const flowSteps = useMemo(() => {
    const steps: { id: FlowStep; label: string }[] = [
      { id: 'orient', label: 'Orient' },
      { id: 'choose', label: 'Choose' },
    ];
    if (!directionalChoice) return steps;
    if (directionalChoice === 'think') {
      steps.push({ id: 'reflect', label: 'Reflect' }, { id: 'synthesize', label: 'Understand' }, { id: 'tasks', label: 'Act' });
    } else if (directionalChoice === 'rebalance') {
      steps.push({ id: 'rebalance', label: 'Stabilize' }, { id: 'synthesize', label: 'Understand' }, { id: 'tasks', label: 'Act' });
    } else {
      steps.push(
        { id: 'reflect', label: 'Reflect' },
        { id: 'rebalance', label: 'Stabilize' },
        { id: 'synthesize', label: 'Understand' },
        { id: 'tasks', label: 'Act' }
      );
    }
    if (createdCount > 0) steps.push({ id: 'done', label: 'Close' });
    return steps;
  }, [directionalChoice, createdCount]);

  const flowStepIndex = flowStep ? flowSteps.findIndex((s) => s.id === flowStep) : -1;
  const selectedTasks = useMemo(
    () => tasks.filter((task, index) => selectedTaskKeys[getTaskKey(task, index)]),
    [tasks, selectedTaskKeys]
  );
  const selectedCount = selectedTasks.length;

  const buildQuestionResponses = useCallback(() => {
    return questions.map((question) => ({
      id: question.id,
      question: question.question,
      answer: (answers[question.id] || '').trim(),
    }));
  }, [answers, questions]);

  const buildAnalysisSnapshot = useCallback(() => {
    if (!analysis) return null;

    return {
      insight: analysis.insight,
      questions,
      mode: analysis.mode,
      lifeAreas: analysis.lifeAreas || [],
    };
  }, [analysis, questions]);

  const persistCognitionSession = useCallback(async (overrides?: {
    questionResponses?: Array<{ id: string; question: string; answer: string }>;
    answers?: Record<string, string>;
  }) => {
    if (!analysis) return;

    const currentAnswers = overrides?.answers || answers;
    const questionResponses = overrides?.questionResponses || questions.map((question) => ({
      id: question.id,
      question: question.question,
      answer: (currentAnswers[question.id] || '').trim(),
    }));
    const generatedTasks = tasks.length > 0 ? tasks : [];

    try {
      const response = await fetch('/api/cognition-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journal_id: journalId || null,
          insight_core: analysis.insight.core,
          insight_tension: analysis.insight.tension,
          mode: analysis.mode || 'planning',
          life_areas: analysis.lifeAreas || [],
          analysis_snapshot: buildAnalysisSnapshot(),
          question_responses: questionResponses,
          generated_tasks: generatedTasks,
          output_state: {
            currentQuestionIndex,
            showThinking,
            createdCount,
            selectedTaskCount: selectedCount,
            whatIUnderstanding,
            summarySections,
            whereYourMindGoing,
            rebalanceChoice,
            rebalanceNotes,
            rebalanceTaskDeadline,
            closingReflection,
            directionalChoice,
            pastOrientation,
          },
          entry_text: normalizedEntry,
          priority,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to save cognition session');
      }

      const payload = await response.json().catch(() => ({}));
      if (payload?.response_id) {
        setSavedSessionId(String(payload.response_id));
      }
    } catch (error) {
      console.warn('[Cognition] Failed to persist session:', error);
    }
  }, [
    analysis,
    answers,
    buildAnalysisSnapshot,
    createdCount,
    currentQuestionIndex,
    directionalChoice,
    pastOrientation,
    journalId,
    normalizedEntry,
    priority,
    questions,
    selectedCount,
    showThinking,
    tasks,
    whatIUnderstanding,
    whereYourMindGoing,
    rebalanceChoice,
    rebalanceNotes,
    rebalanceTaskDeadline,
    closingReflection,
    summarySections,
  ]);

  // Debounced auto-save of answers and output state to ensure zero context loss
  useEffect(() => {
    if (!analysis) return;
    const hasAnyAnswer = Object.values(answers).some((val) => (val || '').trim().length > 0);
    if (!hasAnyAnswer && !rebalanceChoice && !rebalanceNotes) return;

    const timer = setTimeout(() => {
      void persistCognitionSession();
    }, 1500);

    return () => clearTimeout(timer);
  }, [answers, rebalanceChoice, rebalanceNotes, persistCognitionSession, analysis]);

  const restoreSessionToState = useCallback((session: SavedCognitionSession) => {
    const restoredAnalysisSnapshot = session.analysis_snapshot || null;
    const restoredQuestions = restoredAnalysisSnapshot?.questions || (session.question_responses || []).map((item) => ({
      id: item.id,
      question: item.question,
    }));
    const restoredInsight = restoredAnalysisSnapshot?.insight || {
      core: session.insight_core || '',
      tension: session.insight_tension || '',
    };
    const restoredMode = restoredAnalysisSnapshot?.mode || session.mode || 'planning';
    const restoredLifeAreas = restoredAnalysisSnapshot?.lifeAreas || session.life_areas || [];
    const restoredAnswers = (session.question_responses || []).reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.answer || '';
      return acc;
    }, {});
    const restoredTasks = Array.isArray(session.generated_tasks) ? session.generated_tasks : [];
    const restoredOutputState = session.output_state || {};

    setAnalysis({
      insight: restoredInsight,
      questions: restoredQuestions,
      mode: restoredMode,
      lifeAreas: restoredLifeAreas,
    });
    setAnswers(restoredAnswers);
    setTasks(restoredTasks);
    setSelectedTaskKeys(
      restoredTasks.reduce<Record<string, boolean>>((acc, task, index) => {
        acc[getTaskKey(task, index)] = true;
        return acc;
      }, {})
    );
    setCurrentQuestionIndex(Math.min(restoredOutputState.currentQuestionIndex || 0, Math.max(0, restoredQuestions.length - 1)));
    setShowThinking(Boolean(restoredOutputState.showThinking ?? restoredQuestions.length > 0));
    setCreatedCount(restoredTasks.length);
    setSpeechDraft('');
    setSavedSessionId(session.id);
    
    // Restore new sections
    setWhatIUnderstanding(restoredOutputState.whatIUnderstanding || '');
    setSummarySections({
      emotional_landscape: Array.isArray(restoredOutputState.summarySections?.emotional_landscape)
        ? restoredOutputState.summarySections?.emotional_landscape || []
        : [],
      core_tensions: Array.isArray(restoredOutputState.summarySections?.core_tensions)
        ? restoredOutputState.summarySections?.core_tensions || []
        : [],
      patterns_noticed: Array.isArray(restoredOutputState.summarySections?.patterns_noticed)
        ? restoredOutputState.summarySections?.patterns_noticed || []
        : [],
      reflection_prompts: Array.isArray(restoredOutputState.summarySections?.reflection_prompts)
        ? restoredOutputState.summarySections?.reflection_prompts || []
        : [],
      gentle_suggestions: Array.isArray(restoredOutputState.summarySections?.gentle_suggestions)
        ? restoredOutputState.summarySections?.gentle_suggestions || []
        : [],
    });
    setWhereYourMindGoing(restoredOutputState.whereYourMindGoing || '');
    setRebalanceChoice(restoredOutputState.rebalanceChoice || null);
    setRebalanceNotes(restoredOutputState.rebalanceNotes || '');
    setRebalanceTaskDeadline(restoredOutputState.rebalanceTaskDeadline || '');
    setClosingReflection(restoredOutputState.closingReflection || '');
    const restoredDir = restoredOutputState.directionalChoice;
    const dir =
      restoredDir === 'think' || restoredDir === 'rebalance' || restoredDir === 'both' ? restoredDir : null;
    setDirectionalChoice(dir);
    setPastOrientation(
      Boolean(restoredOutputState.pastOrientation) || Boolean(dir) || Boolean(restoredOutputState.whatIUnderstanding)
    );
    setRebalancePhaseDone(
      Boolean(restoredOutputState.rebalanceChoice) ||
        dir === 'rebalance' ||
        Boolean(restoredOutputState.whatIUnderstanding)
    );
  }, [getTaskKey]);

  const loadSavedSession = useCallback(async () => {
    if (!journalId) return;
    if (loadedSessionJournalIdRef.current === journalId || loadedCognitionSessionJournalIds.has(journalId)) return;

    setIsHydratingSession(true);
    try {
      const response = await fetch(`/api/cognition-responses?journal_id=${encodeURIComponent(journalId)}&limit=1`);
      if (!response.ok) {
        return;
      }

      const payload = await response.json().catch(() => ({}));
      const rawResponses = Array.isArray(payload?.responses) ? payload.responses : [];
      // Decrypt responses
      const responses = await Promise.all(
        rawResponses.map(async (row: any) => {
          const dec = await decryptCognition(row);
          return {
            ...row,
            insight_core: dec.insight_core ?? row.insight_core,
            insight_tension: dec.insight_tension ?? row.insight_tension,
            entry_text: dec.entry_text ?? row.entry_text,
            question_responses: dec.question_responses ?? row.question_responses,
            analysis_snapshot: dec.analysis_snapshot ?? row.analysis_snapshot,
            generated_tasks: dec.generated_tasks ?? row.generated_tasks,
            output_state: dec.output_state ?? row.output_state,
          } as SavedCognitionSession;
        })
      );
      const latest = responses[0];
      if (!latest) {
        return;
      }
      restoreSessionToState(latest);
      setSavedSessionData(latest);
      loadedSessionJournalIdRef.current = journalId;
      loadedCognitionSessionJournalIds.add(journalId);
    } catch (error) {
      console.warn('[Cognition] Failed to load saved session:', error);
    } finally {
      setIsHydratingSession(false);
      loadedSessionJournalIdRef.current = journalId;
      loadedCognitionSessionJournalIds.add(journalId);
    }
  }, [journalId, restoreSessionToState]);

  useEffect(() => {
    void loadSavedSession();
  }, [loadSavedSession]);

  // Auto-generate "What I'm understanding" (and draft closing) once synthesis step unlocks
  useEffect(() => {
    if (!synthesisReady || !analysis) return;
    if (whatIUnderstanding) return;

    const generate = async () => {
      const questionResponses = buildQuestionResponses();
      try {
        const resp = await fetch('/api/cognition-summaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionResponses, insight: analysis.insight }),
        });
        if (!resp.ok) return;
        const data = await resp.json().catch(() => ({}));
        if (data?.emotional_landscape || data?.core_tensions || data?.patterns_noticed || data?.reflection_prompts || data?.gentle_suggestions) {
          setSummarySections({
            emotional_landscape: Array.isArray(data.emotional_landscape) ? data.emotional_landscape.map((item: unknown) => String(item)) : [],
            core_tensions: Array.isArray(data.core_tensions) ? data.core_tensions.map((item: unknown) => String(item)) : [],
            patterns_noticed: Array.isArray(data.patterns_noticed) ? data.patterns_noticed.map((item: unknown) => String(item)) : [],
            reflection_prompts: Array.isArray(data.reflection_prompts) ? data.reflection_prompts.map((item: unknown) => String(item)) : [],
            gentle_suggestions: Array.isArray(data.gentle_suggestions) ? data.gentle_suggestions.map((item: unknown) => String(item)) : [],
          });
        }
        if (data?.whatIUnderstanding) setWhatIUnderstanding(String(data.whatIUnderstanding));
      } catch (e) {
        // ignore
      }
    };

    void generate();
  }, [synthesisReady, analysis, whatIUnderstanding, buildQuestionResponses]);

  useEffect(() => {
    if (!journalId || !analysis || isHydratingSession) return;

    const timer = window.setTimeout(() => {
      void persistCognitionSession();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [analysis, answers, createdCount, currentQuestionIndex, directionalChoice, pastOrientation, isHydratingSession, journalId, persistCognitionSession, priority, selectedCount, showThinking, tasks, whatIUnderstanding, whereYourMindGoing, rebalanceChoice, rebalanceNotes, closingReflection]);

  const stopAnswerRecording = async () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }

    setIsRecordingAnswer(false);
  };

  const ensurePuterLoaded = async (): Promise<any> => {
    if (typeof window === 'undefined') return null;
    const win = window as any;
    if (win.puter?.ai?.speech2txt) {
      return win.puter;
    }
    return new Promise((resolve) => {
      let script = document.querySelector('script[src*="js.puter.com"]') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://js.puter.com/v2/';
        script.async = true;
        document.head.appendChild(script);
      }
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if ((window as any).puter?.ai?.speech2txt) {
          clearInterval(interval);
          resolve((window as any).puter);
        } else if (attempts >= 30) {
          clearInterval(interval);
          resolve((window as any).puter || null);
        }
      }, 100);
    });
  };

  const transcribeAnswerAudio = async (audioBlob: Blob): Promise<string> => {
    // 1. Primary: Puter.js AI Speech-to-Text directly in browser (fast, direct, zero server bottleneck)
    try {
      const puter = await ensurePuterLoaded();
      if (puter?.ai?.speech2txt) {
        console.log('[Cognition] Transcribing voice directly with Puter AI...', audioBlob.type, audioBlob.size);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const audioFile = new File([audioBlob], `cognition_voice_${timestamp}.webm`, { type: audioBlob.type || 'audio/webm' });
        
        let result: any = null;
        try {
          result = await puter.ai.speech2txt(audioBlob);
        } catch (blobErr) {
          console.warn('[Cognition] Puter blob transcription failed, retrying with audioFile:', blobErr);
          result = await puter.ai.speech2txt(audioFile);
        }

        let transcriptText = '';
        if (typeof result === 'string') {
          transcriptText = result.trim();
        } else if (result && typeof result === 'object') {
          transcriptText = String(result.text || result.transcript || result.transcription || result.data || '').trim();
        }

        if (transcriptText) {
          console.log('[Cognition] Puter.js transcription succeeded:', transcriptText);
          showToast('⚡ Transcribed with Puter AI', 'success');
          return transcriptText;
        }
      }
    } catch (puterErr) {
      console.warn('[Cognition] Puter.js direct transcription failed, falling back to server transcription:', puterErr);
    }

    // 2. Secondary fallback: Internal voice-transcript route (Deepgram / Whisper / Imentiv fallback)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const audioFile = new File([audioBlob], `cognition_answer_${timestamp}.webm`, { type: audioBlob.type || 'audio/webm' });
    const formData = new FormData();
    formData.append('audioFile', audioFile);

    const response = await fetch('/api/voice-transcript', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `Transcription failed (${response.status})`;
      try {
        const payload = await response.json();
        errorMessage = payload?.error || payload?.message || errorMessage;
      } catch {
        const rawText = await response.text().catch(() => '');
        if (rawText) {
          errorMessage = rawText;
        }
      }
      throw new Error(errorMessage);
    }

    const payload = await response.json().catch(() => ({}));
    return String(payload?.transcript || '').trim();
  };

  const initializeSpeechRecognition = async () => {
    if (isRecordingAnswer) {
      await stopAnswerRecording();
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      showToast('Voice recording is not supported in this browser.', 'error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });
      recorderRef.current = recorder;
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      setSpeechDraft('');
      setIsRecordingAnswer(true);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecordingAnswer(false);

        const chunks = [...audioChunksRef.current];
        audioChunksRef.current = [];
        audioStreamRef.current?.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;

        const audioBlob = new Blob(chunks, { type: mimeType });
        if (!audioBlob.size) {
          showToast('No audio was captured. Try speaking closer to the microphone.', 'error');
          return;
        }

        try {
          setIsTranscribingAnswer(true);
          const transcript = await transcribeAnswerAudio(audioBlob);
          if (!transcript) {
            throw new Error('No words detected. Try speaking more clearly.');
          }

          if (currentQuestion) {
            setAnswers((prev) => {
              const existing = (prev[currentQuestion.id] || '').trim();
              const nextValue = existing ? `${existing} ${transcript}` : transcript;
              return { ...prev, [currentQuestion.id]: nextValue };
            });
          }

          setSpeechDraft('');
          showToast('Transcribed answer added!', 'success');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to transcribe audio.';
          console.error('[Cognition] Transcription failed:', error);
          showToast(message, 'error');
        } finally {
          setIsTranscribingAnswer(false);
        }
      };

      recorder.onerror = (event) => {
        console.error('[Cognition] MediaRecorder error', event);
        setIsRecordingAnswer(false);
        setIsTranscribingAnswer(false);
        setSpeechDraft('');
        showToast('Voice recording failed. Please try again.', 'error');
      };

      // Collect chunks every 250ms so onstop always has buffered data
      recorder.start(250);
    } catch (error) {
      console.error('[Cognition] Failed to start voice recording', error);
      setIsRecordingAnswer(false);
      setSpeechDraft('');
      showToast('Microphone access failed. Please allow microphone permission.', 'error');
    }
  };

  const runAnalyze = async () => {
    if (!normalizedEntry) {
      showToast('Entry content is empty for cognition analysis.', 'error');
      return;
    }

    setIsAnalyzing(true);
    setTasks([]);
    setSelectedTaskKeys({});
    setCreatedCount(0);
    setShowThinking(false);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setSpeechDraft('');
    setRebalanceChoice(null);
    setRebalanceNotes('');
    setRebalanceTaskDeadline('');
    setClosingReflection('');
    setPastOrientation(false);
    setDirectionalChoice(null);
    setRebalancePhaseDone(false);

    try {
      const response = await fetch('/api/analyze-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry: normalizedEntry, previousQuestionResponses: savedSessionData?.question_responses ? savedSessionData.question_responses.slice(-4) : [] }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Failed to analyze entry');
      }

      const payload = (await response.json()) as AnalyzeResponse & { summary?: string };
      setAnalysis(payload);
      // If the engine provided a short summary about where your attention is going,
      // pre-fill the 'Where your mind is going' interpretation so users see more than tags.
      if (payload?.summary && !whereYourMindGoing) {
        setWhereYourMindGoing(payload.summary);
      }

      showToast('Cognition workspace is ready.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to analyze entry';
      showToast(message, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runGenerateTasks = async () => {
    if (!analysis) return;

    setIsGenerating(true);
    try {
      const ensureSentence = (t: string) => {
        const s = (t || '').trim();
        if (!s) return s;
        return /[.!?]$/.test(s) ? s : s + '.';
      };

      const questionResponses = questions.map((question) => ({
        id: question.id,
        question: question.question,
        answer: ensureSentence(answers[question.id] || ''),
      }));

      const response = await fetch('/api/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: analysis.mode,
          insight: analysis.insight,
          questions,
          questionResponses,
          priority,
          whatIUnderstanding,
          whereYourMindGoing,
          rebalanceChoice,
          rebalanceNotes,
          closingReflection,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error || 'Failed to generate tasks');
      }

      const payload = await response.json();
      const generatedTasks = Array.isArray(payload?.tasks) ? (payload.tasks as GeneratedTask[]) : [];
      setTasks((existingTasks) => {
        const mergedTasks = [...existingTasks];
        const seenTitles = new Set(existingTasks.map((task) => task.title.trim().toLowerCase()));

        for (const task of generatedTasks) {
          const titleKey = task.title.trim().toLowerCase();
          if (seenTitles.has(titleKey)) {
            continue;
          }
          seenTitles.add(titleKey);
          mergedTasks.push(task);
        }

        setSelectedTaskKeys((prev) => {
          const next = { ...prev };
          mergedTasks.forEach((task, index) => {
            const key = getTaskKey(task, index);
            if (index >= existingTasks.length) {
              next[key] = true;
            } else if (!(key in next)) {
              next[key] = true;
            }
          });
          return next;
        });

        setTaskDeadlines((prev) => {
          const next = { ...prev };
          mergedTasks.forEach((task, index) => {
            const key = getTaskKey(task, index);
            if (!next[key] && task.suggested_deadline) {
              next[key] = formatForDateTimeLocal(task.suggested_deadline);
            }
          });
          return next;
        });

        return mergedTasks;
      });

      if (generatedTasks.length === 0) {
        showToast('No tasks were generated from this input.', 'info');
        return;
      }

      showToast(`Generated ${generatedTasks.length} smart task${generatedTasks.length === 1 ? '' : 's'}. Review and confirm to add to your list.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate tasks';
      showToast(message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const addGeneratedTasksToList = async () => {
    if (!analysis || tasks.length === 0) return;

    if (selectedTasks.length === 0) {
      showToast('Select at least one task to add.', 'info');
      return;
    }

    setIsGenerating(true);
    try {
      const questionResponses = questions.map((question) => ({
        id: question.id,
        question: question.question,
        answer: (answers[question.id] || '').trim(),
      }));

      // Store cognition responses and session state
      try {
        await persistCognitionSession();
      } catch (responseError) {
        console.warn('[Cognition] Failed to store responses:', responseError);
      }

      // Build task payloads including user-selected / suggested deadlines and full metadata
      const allTasksWithMeta = tasks.map((task, index) => {
        const key = getTaskKey(task, index);
        const dueLocal = taskDeadlines[key];
        const dueIso = dueLocal ? new Date(dueLocal).toISOString() : task.suggested_deadline || null;
        return {
          ...task,
          due_date: dueIso,
          description: task.description || task.subtasks?.join(' | ') || null,
          category: task.category || 'Personal',
        };
      });

      const selectedTasksPayload = allTasksWithMeta.filter((t, index) => selectedTaskKeys[getTaskKey(t as any, index)]);

      const createResponse = await fetch('/api/ai-todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_generated_tasks',
          mode: analysis.mode,
          responses: Object.fromEntries(questionResponses.map((item) => [item.id, item.answer])),
          tasks: selectedTasksPayload,
          insight: analysis.insight,
          lifeAreas: analysis.lifeAreas,
        }),
      });

      if (!createResponse.ok) {
        const createPayload = await createResponse.json().catch(() => ({}));
        throw new Error(createPayload?.error || 'Tasks could not be saved');
      }

      const createPayload = await createResponse.json();
      const totalCreated = Number(createPayload?.created || 0);
      const createdTodos = Array.isArray(createPayload?.todos) ? (createPayload.todos as Array<{ title?: string }>) : [];
      setCreatedCount(totalCreated);
      window.dispatchEvent(new Event('force:todo-updated'));
      createdTodos.forEach((todo) => {
        if (!todo?.title) return;
        announceTaskAdded({ title: todo.title, source: 'cognition' });
      });
      showToast(`Saved ${totalCreated} task${totalCreated === 1 ? '' : 's'} to your Task board.`, 'success');

      if (totalCreated > 0) {
        try {
          const closure = await fetch('/api/cognition-summaries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              closingOnly: true,
              questionResponses,
              insight: analysis.insight,
              whatIUnderstanding,
            }),
          });
          if (closure.ok) {
            const clo = await closure.json().catch(() => ({}));
            if (clo?.closingReflection) setClosingReflection(String(clo.closingReflection));
          }
        } catch {
          /* non-blocking */
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save tasks';
      showToast(message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const rebalanceTaskPreview = useMemo(
    () => buildRebalanceTaskPreview(rebalanceChoice, rebalanceNotes),
    [rebalanceChoice, rebalanceNotes]
  );

  const rebalanceOutput = useMemo(
    () => buildRebalanceOutput(rebalanceChoice, rebalanceNotes, analysis?.lifeAreas),
    [analysis?.lifeAreas, rebalanceChoice, rebalanceNotes]
  );

  const addRebalanceTaskToList = useCallback(() => {
    if (!rebalanceTaskPreview) {
      showToast('Choose a rebalance path first.', 'info');
      return;
    }
    if (rebalanceTaskPreview.needsRefinement) {
      showToast(rebalanceTaskPreview.helperText, 'info');
      return;
    }

    const nextIndex = tasks.length;
    const previewTask = rebalanceTaskPreview.task;
    const previewKey = getTaskKey(previewTask, nextIndex);

    setTasks((prev) => [...prev, previewTask]);
    setSelectedTaskKeys((prev) => ({ ...prev, [previewKey]: true }));
    setTaskDeadlines((prev) => ({ ...prev, [previewKey]: rebalanceTaskDeadline || null }));
    setRebalanceChoice(null);
    setRebalanceNotes('');
    setRebalanceTaskDeadline('');
    showToast('Added the rebalance task preview to your task list.', 'success');
  }, [rebalanceTaskDeadline, rebalanceTaskPreview, showToast, tasks.length]);

  const clearRebalanceDraft = useCallback(() => {
    setRebalanceChoice(null);
    setRebalanceNotes('');
    setRebalanceTaskDeadline('');
  }, []);

  const renderUnderstanding = () => (
    <div className="rounded-xl bg-[#fffaf5] p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7a6557]">What I am understanding from you</p>
      <p className="mt-1 text-xs text-[#8a7263]">A short synthesis from your entry and reflections — read only.</p>
      {whatIUnderstanding ? (
        <p className="mt-3 text-sm leading-relaxed text-[#3d2e26]">{whatIUnderstanding}</p>
      ) : (
        <p className="mt-3 text-sm text-[#a98d7a]">Pulling this together...</p>
      )}
    </div>
  );

  const renderStepProgress = () => (
    <div className="-mx-1 mt-5 overflow-x-auto pb-1 sm:mx-0">
      <div className="flex min-w-max snap-x snap-mandatory items-center gap-2 px-1">
        {flowSteps.map((step, index) => {
          const isComplete = flowStepIndex > index;
          const isCurrent = flowStep === step.id;
          return (
            <div key={step.id} className="flex shrink-0 snap-start items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                  isCurrent
                    ? 'border-[#8f7363] bg-[#2f241f] text-white'
                    : isComplete
                      ? 'border-[#c4a894] bg-[#f3e6dc] text-[#4a362a]'
                      : 'border-[#d8c6b8] bg-white text-[#8a7263]'
                }`}
              >
                {isComplete ? <Check size={12} /> : null}
                {index + 1}. {step.label}
              </span>
              {index < flowSteps.length - 1 ? <span className="h-px w-6 bg-[#dccdbf]" aria-hidden /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  const goBackToChoice = () => {
    // Allow user to go back to the choice/orient step to pick a different path
    setDirectionalChoice(null);
    setShowThinking(false);
    setReflectPhaseDone(false);
    setRebalancePhaseDone(false);
    // keep pastOrientation true so they don't lose orientation progress
    setPastOrientation(true);
  };

  return (
    <section className="min-w-0 rounded-2xl bg-[#fffdf9] p-3 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#8a7263] sm:text-[11px]">Cognition Engine</p>
          <h3 className="mt-1 text-lg font-semibold text-[#2f241f] sm:text-xl" style={{ fontFamily: "'Iowan Old Style', 'Palatino Linotype', serif" }}>
            One step at a time
          </h3>
          <p className="mt-1 text-sm text-[#6e5a4b]">Orient, choose your path, then move toward grounded action.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {analysis && flowStep && flowStep !== 'orient' ? (
            <button type="button" onClick={goBackToChoice} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#d8c6b8] bg-white px-3 py-2 text-sm font-semibold text-[#6e5a4b] sm:w-auto">
              <ChevronLeft size={14} /> Back
            </button>
          ) : null}

          {!analysis ? (
          <button
            type="button"
            onClick={runAnalyze}
            disabled={isAnalyzing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#b39c8a] bg-[#2f241f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#47342b] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isAnalyzing ? <Brain size={14} className="animate-pulse" /> : <Sparkles size={14} />}
            {isAnalyzing ? 'Reading your entry...' : 'Begin'}
          </button>
          ) : null}
        </div>
      </div>

      {analysis && flowStep && (
        <div className="mt-5 space-y-4">
          {renderStepProgress()}

          {flowStep === 'orient' && (
          <div className="rounded-xl bg-[#fffcf8] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a7263]">Step 1 — See what matters</p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[#8a7263]">Core insight</p>
                <p className="mt-1 text-sm leading-6 text-[#3d2e26]">{analysis.insight.core}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[#8a7263]">Tension</p>
                <p className="mt-1 text-sm text-[#6f5647]">{analysis.insight.tension}</p>
              </div>
              
              {((analysis.lifeAreas && analysis.lifeAreas.length > 0) || analysis.summary) && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[#8a7263]">Where your mind is going</p>
                  {analysis.lifeAreas && analysis.lifeAreas.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {analysis.lifeAreas.map((area) => (
                        <span key={area} className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${LIFE_AREA_COLORS[area]}`}>
                          {LIFE_AREA_LABELS[area]}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {analysis.summary ? (
                    <div className="mt-3">
                      <p className="text-sm leading-relaxed break-words whitespace-normal" style={{ color: '#6f5647' }}>{analysis.summary}</p>
                    </div>
                  ) : null}
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-[#8a7263] mt-3 border-t border-[#e7d9cd] pt-3">
                Narrative momentum: each step should feel more oriented and less fragmented — not like another loop of analysis.
              </p>

              {!pastOrientation ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setPastOrientation(true);
                      if (analysis.summary && !whereYourMindGoing.trim()) {
                        setWhereYourMindGoing(analysis.summary);
                      }
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#b39c8a] bg-[#2f241f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#47342b] sm:w-auto"
                  >
                    Continue
                  </button>
                  <p className="mt-2 text-xs text-[#7a6557]">When you are ready, we will ask what you want to do next.</p>
                </div>
              ) : null}
            </div>
            {pastOrientation ? (
            <div className="mt-4 rounded-lg bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-[#3e2f27]">What do you want to do next?</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setDirectionalChoice('think');
                    setShowThinking(true);
                    setReflectPhaseDone(false);
                    setRebalancePhaseDone(false);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#b39c8a] bg-[#2f241f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#47342b]"
                >
                  Think this through
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDirectionalChoice('rebalance');
                    setShowThinking(false);
                    setReflectPhaseDone(true);
                    setRebalancePhaseDone(false);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#d8c6b8] bg-[#fffdfa] px-4 py-2.5 text-sm font-semibold text-[#6e5a4b] transition hover:bg-[#faf6f0]"
                >
                  Rebalance myself
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDirectionalChoice('both');
                    setShowThinking(true);
                    setReflectPhaseDone(false);
                    setRebalancePhaseDone(false);
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#c9b29f] bg-[#f6efe6] px-4 py-2.5 text-sm font-semibold text-[#4a362a] transition hover:bg-[#efe3d6]"
                >
                  Both
                </button>
              </div>
            </div>
            ) : null}
          </div>
          )}

          {flowStep === 'choose' && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a7263]">Step 2 — What do you want to do next?</p>
              <p className="mt-2 text-sm text-[#6f5647]">Pick one path. Your answers stay private and feed the next steps only.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <button type="button" onClick={() => { setDirectionalChoice('think'); setShowThinking(true); setReflectPhaseDone(false); setRebalancePhaseDone(false); }} className="rounded-xl border border-[#b39c8a] bg-[#2f241f] px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-[#47342b]">
                  Think this through
                  <span className="mt-1 block text-xs font-normal text-white/80">A few guided questions</span>
                </button>
                <button type="button" onClick={() => { setDirectionalChoice('rebalance'); setShowThinking(false); setReflectPhaseDone(true); setRebalancePhaseDone(false); }} className="rounded-xl border border-[#d8c6b8] bg-[#fffdfa] px-4 py-3 text-left text-sm font-semibold text-[#6e5a4b] transition hover:bg-[#faf6f0]">
                  Rebalance myself
                  <span className="mt-1 block text-xs font-normal text-[#8a7263]">Stabilize first</span>
                </button>
                <button type="button" onClick={() => { setDirectionalChoice('both'); setShowThinking(true); setReflectPhaseDone(false); setRebalancePhaseDone(false); }} className="rounded-xl border border-[#c9b29f] bg-[#f6efe6] px-4 py-3 text-left text-sm font-semibold text-[#4a362a] transition hover:bg-[#efe3d6]">
                  Both
                  <span className="mt-1 block text-xs font-normal text-[#6f5647]">Reflect, then rebalance</span>
                </button>
              </div>
            </div>
          )}

          {flowStep === 'reflect' && currentQuestion && (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a7263]">Step — Reflect</p>
              <p className="mt-1 text-xs text-[#8a7263]">Your answers are used privately to shape the next steps and are not shown again.</p>
              <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[#8a7263]">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </p>
                {questions.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentQuestionIndex((value) => Math.max(0, value - 1))}
                      disabled={currentQuestionIndex === 0}
                      className="inline-flex items-center gap-1 rounded-full border border-[#d8c6b8] px-3 py-1 text-xs font-semibold text-[#6e5a4b] disabled:opacity-40"
                    >
                      <ChevronLeft size={12} />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const currentAns = (answers[currentQuestion.id] || '').trim();
                        if (currentAns.length === 0) return;
                        setCurrentQuestionIndex((value) => Math.min(questions.length - 1, value + 1));
                      }}
                      disabled={currentQuestionIndex === questions.length - 1 || !(answers[currentQuestion.id] || '').trim()}
                      className="inline-flex items-center gap-1 rounded-full border border-[#d8c6b8] px-3 py-1 text-xs font-semibold text-[#6e5a4b] disabled:opacity-40"
                      title={!(answers[currentQuestion.id] || '').trim() ? 'Please answer before moving to the next question' : undefined}
                    >
                      Next
                      <ChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>

              <p className="mt-3 text-sm font-semibold text-[#3b2d25]">{currentQuestion.question}</p>
              
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                <textarea
                  rows={4}
                  value={answers[currentQuestion.id] || ''}
                  onChange={(event) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: event.target.value }))}
                  className="min-h-[120px] w-full flex-1 rounded-lg border border-[#d8c6b8] bg-[#fffdfa] px-3 py-2 text-sm text-[#3d2e26] outline-none focus:border-[#a98d7a]"
                  placeholder="Write your answer or speak..."
                />
                <button
                  type="button"
                  onClick={initializeSpeechRecognition}
                  className={`rounded-lg px-3 py-2 transition ${
                    isRecordingAnswer || isTranscribingAnswer
                      ? 'border border-red-300 bg-red-50 text-red-600'
                      : 'border border-[#d8c6b8] bg-[#fffdfa] text-[#6e5a4b] hover:bg-[#faf6f0]'
                  } w-full sm:w-auto`}
                  title={isRecordingAnswer ? 'Stop recording' : isTranscribingAnswer ? 'Transcribing answer' : 'Record voice answer'}
                >
                  {isTranscribingAnswer ? <Clock3 size={18} className="animate-spin" /> : isRecordingAnswer ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#7a6557]">
                <span>
                  {isRecordingAnswer ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-red-600 animate-pulse">
                      🔴 Recording audio... Click mic again to finish & transcribe with Puter AI
                    </span>
                  ) : isTranscribingAnswer ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 animate-pulse">
                      ⚡ Transcribing with Puter AI... please wait
                    </span>
                  ) : (
                    'Type or click mic to speak — Puter AI transcribes your voice directly.'
                  )}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const currentAns = (answers[currentQuestion.id] || '').trim();
                    if (!currentAns) {
                      showToast('Please provide an answer before continuing.', 'info');
                      return;
                    }

                    // Immediately persist current answer to prevent context loss
                    const updatedAnswers = { ...answers, [currentQuestion.id]: currentAns };
                    const updatedResponses = questions.map((q) => ({
                      id: q.id,
                      question: q.question,
                      answer: (updatedAnswers[q.id] || '').trim(),
                    }));
                    void persistCognitionSession({ answers: updatedAnswers, questionResponses: updatedResponses });

                    if (isLastQuestion) {
                      if (!responsesReady) {
                        showToast('Please answer all questions before proceeding.', 'info');
                        return;
                      }
                      setReflectPhaseDone(true);
                    } else {
                      setCurrentQuestionIndex((value) => Math.min(questions.length - 1, value + 1));
                    }
                  }}
                  disabled={!(answers[currentQuestion.id] || '').trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#b39c8a] bg-[#2f241f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#47342b] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isLastQuestion
                    ? directionalChoice === 'both'
                      ? 'Continue to Stabilize →'
                      : 'Continue to Synthesis →'
                    : 'Next question →'}
                </button>

                {savedSessionId && (
                  <span className="text-xs text-[#8a7263] flex items-center gap-1.5 font-medium">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                    Answers saved to memory
                  </span>
                )}
              </div>
              </div>
            </div>
          )}

          {flowStep === 'rebalance' && (
            <div className="rounded-xl bg-[#fffaf5]/95 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a7263]">Step — Stabilize</p>
              <div className="rounded-lg bg-[#fffaf5]/95 p-4">
                  <p className="mt-2 text-sm text-[#6f5647]">
                    Rebalance means shifting from emotional immersion into stabilization — not avoiding how you feel or forcing positivity.
                    {' '}
                    Pick one direction for the next small move.
                  </p>
                  <div className="mt-4 space-y-2">
                    {[
                      { value: 'reset' as RebalanceOption, label: 'Reset myself', desc: 'Do something that helps you feel grounded' },
                      { value: 'move' as RebalanceOption, label: 'Move something forward', desc: 'Take one small step on what matters' },
                      { value: 'reach_out' as RebalanceOption, label: 'Reach out to someone', desc: 'Talk to someone who feels safe' },
                      { value: 'sit_with' as RebalanceOption, label: 'Sit with this and think it through', desc: 'Stay with it, but with more clarity' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setRebalanceChoice(option.value);
                          setRebalanceNotes('');
                          setRebalanceTaskDeadline('');
                        }}
                        className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                          rebalanceChoice === option.value
                            ? 'border-[#8f7363] bg-[#f3e6dc]'
                            : 'border-[#d8c6b8] bg-white hover:bg-[#faf6f0]'
                        }`}
                      >
                        <p className="text-sm font-semibold text-[#3a2c24]">{option.label}</p>
                        <p className="text-xs text-[#6f5647]">{option.desc}</p>
                      </button>
                    ))}
                  </div>
                  {rebalanceChoice && (
                    <div className="mt-4 space-y-3">
                      {rebalanceOutput && (
                        <div className="rounded-xl border border-[#d9cabd] bg-[#fcf7f1] p-3 shadow-sm sm:p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[#8a7263]">Rebalance output</p>
                              <h4 className="mt-1 text-base font-semibold text-[#2f241f]">
                                {REBALANCE_OPTION_LABELS[rebalanceChoice]}
                              </h4>
                            </div>
                            <span className="rounded-full border border-[#d7c5b8] bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#6f5647]">
                              {REBALANCE_OPTION_SHIFTS[rebalanceChoice]}
                            </span>
                          </div>

                          <div className="mt-3 space-y-2 text-sm text-[#5e4a3e]">
                            <p className="leading-6">{rebalanceOutput.focusLine}</p>
                            <p className="leading-6 font-medium text-[#3a2c24]">{rebalanceOutput.shiftLine}</p>
                            <p className="leading-6">{rebalanceOutput.actionLine}</p>
                          </div>
                        </div>
                      )}

                      <textarea
                        rows={3}
                        value={rebalanceNotes}
                        onChange={(e) => setRebalanceNotes(e.target.value)}
                        placeholder={REBALANCE_PROMPTS[rebalanceChoice]}
                        className="w-full rounded border border-[#d8c6b8] bg-[#fffdfa] px-3 py-2 text-sm text-[#3d2e26] outline-none focus:border-[#a98d7a]"
                      />

                      {rebalanceTaskPreview ? (
                        rebalanceTaskPreview.needsRefinement ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            {rebalanceTaskPreview.helperText}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-[#d9cabd] bg-white p-4 shadow-sm min-w-0">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7a6557]">Task preview</p>
                                <h4 className="mt-1 text-base font-semibold text-[#3a2c24] break-words whitespace-normal [overflow-wrap:anywhere]">
                                  {rebalanceTaskPreview.task.title}
                                </h4>
                                <p className="mt-1 text-sm text-[#6f5647] break-words whitespace-normal [overflow-wrap:anywhere]">{rebalanceTaskPreview.helperText}</p>
                              </div>
                              <span className="shrink-0 self-start rounded-full border border-[#d7c5b8] bg-[#fbf3ec] px-2 py-0.5 text-[10px] font-bold uppercase text-[#6f5647] break-words">
                                {rebalanceTaskPreview.task.estimated_time}
                              </span>
                            </div>

                            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#5e4a3e]">
                              {rebalanceTaskPreview.task.subtasks.map((subtask, subIndex) => (
                                <li key={`${rebalanceTaskPreview.task.title}-rebalance-sub-${subIndex}`} className="break-words whitespace-normal [overflow-wrap:anywhere] leading-relaxed">
                                  {subtask}
                                </li>
                              ))}
                            </ul>

                            <div className="mt-3">
                              <label className="text-xs text-[#6f5647]">Deadline (optional)</label>
                              <input
                                type="datetime-local"
                                value={rebalanceTaskDeadline}
                                onChange={(event) => setRebalanceTaskDeadline(event.target.value)}
                                className="mt-1 w-full rounded border border-[#d8c6b8] px-2 py-1 text-sm text-[#3d2e26]"
                              />
                            </div>

                            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              <button
                                type="button"
                                onClick={addRebalanceTaskToList}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#b39c8a] bg-[#2f241f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#47342b] sm:w-auto"
                              >
                                Add to tasks
                              </button>
                              <button
                                type="button"
                                onClick={clearRebalanceDraft}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#d8c6b8] bg-white px-4 py-2 text-sm font-semibold text-[#6e5a4b] transition hover:bg-[#fbf8f3] sm:w-auto"
                              >
                                Skip for now
                              </button>
                            </div>
                          </div>
                        )
                      ) : null}
                    </div>
                  )}
                </div>
              <button type="button" onClick={() => setRebalancePhaseDone(true)} disabled={!rebalanceChoice} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#b39c8a] bg-[#2f241f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#47342b] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
                Continue to understanding
              </button>
              <button type="button" onClick={() => { clearRebalanceDraft(); setRebalancePhaseDone(true); }} className="mt-2 block w-full text-center text-xs font-semibold text-[#7a6557] underline-offset-2 hover:underline sm:w-auto sm:text-left">
                Skip rebalance for now
              </button>
            </div>
          )}

          {flowStep === 'synthesize' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#8a7263]">Step — Understand</p>
              {renderUnderstanding()}
              {tasks.length === 0 && (
                <button
                  type="button"
                  onClick={runGenerateTasks}
                  disabled={isGenerating}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#b39c8a] bg-[#2f241f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#47342b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating ? <Clock3 size={14} className="animate-spin" /> : <ListChecks size={14} />}
                  {isGenerating ? 'Building suggestions...' : 'Suggest grounded tasks'}
                </button>
              )}
            </div>
          )}
          {flowStep === 'tasks' && tasks.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-[#6c5445]" />
                <p className="text-sm font-semibold text-[#3e2f27]">Based on what you said, here's what matters now:</p>
              </div>
              
              {tasks.map((task, index) => {
                const key = getTaskKey(task, index);
                const deadlineValue = taskDeadlines[key] || '';
                const allocationLabel = task.allocation === 'focus_today' ? 'Focus Today' : task.allocation === 'also_today' ? 'Also Today' : 'Space for Later';
                const allocationColor = task.allocation === 'focus_today'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : task.allocation === 'also_today'
                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                return (
                <article key={`${task.title}-${index}`} className="rounded-xl border border-[#e2d5c8] bg-white p-3.5 sm:p-4 shadow-sm transition hover:shadow-md min-w-0">
                  <div className="flex flex-col gap-3 min-w-0 w-full">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedTaskKeys[getTaskKey(task, index)] || false}
                        onChange={() => {
                          const key = getTaskKey(task, index);
                          setSelectedTaskKeys((prev) => ({ ...prev, [key]: !prev[key] }));
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#d8c6b8] bg-white text-[#2f241f] focus:ring-0 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-[#3a2c24] break-words whitespace-normal leading-snug [overflow-wrap:anywhere]">{task.title}</h4>
                        {task.description && (
                          <p className="mt-1.5 text-xs leading-relaxed text-[#655246] break-words whitespace-normal [overflow-wrap:anywhere]">{task.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pl-6.5 sm:pl-7">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#745f51] break-words">⏱️ {task.estimated_time}</span>
                      {task.category && (
                        <span className="rounded-full border border-[#d8c6b8] bg-[#fbf6f0] px-2 py-0.5 text-[10px] font-bold text-[#624f42] break-words">
                          📁 {task.category}
                        </span>
                      )}
                      {task.allocation && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold break-words ${allocationColor}`}>
                          ✦ {allocationLabel}
                        </span>
                      )}
                    </div>

                    {task.subtasks && task.subtasks.length > 0 && (
                      <div className="pl-6.5 sm:pl-7 min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8a7263]">Action Steps</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-[#5e4a3e]">
                          {task.subtasks.map((subtask, subIndex) => (
                            <li key={`${task.title}-sub-${subIndex}`} className="break-words whitespace-normal [overflow-wrap:anywhere] leading-relaxed">{subtask}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="pl-6.5 sm:pl-7 grid gap-2.5 sm:grid-cols-2 pt-1">
                      <div>
                        <label className="text-xs font-semibold text-[#6f5647]">Scheduled Deadline</label>
                        <input
                          type="datetime-local"
                          value={deadlineValue}
                          onChange={(e) => setTaskDeadlines((prev) => ({ ...prev, [key]: e.target.value || null }))}
                          className="mt-1 w-full rounded-lg border border-[#d8c6b8] bg-[#fffdfb] px-2.5 py-1 text-xs text-[#3d2e26] focus:border-[#8f7363] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[#6f5647]">Priority</label>
                        <div className="mt-1 flex gap-1.5">
                          {[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setTasks((prev) => prev.map((t, i) => (i === index ? { ...t, priority: opt.value as 'high' | 'medium' | 'low' } : t)))}
                              className={`flex-1 rounded-lg border py-1 text-center text-xs font-semibold transition ${
                                task.priority === opt.value ? 'border-[#8f7363] bg-[#2f241f] text-white' : 'border-[#d8c6b8] bg-white text-[#705a4b] hover:bg-[#faf4ee]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
                );
              })}
              
              <div className="rounded-lg border border-[#e8dccc] bg-[#fffaf5] p-4">
                <p className="text-sm font-semibold text-[#3e2f27] mb-3">Ready to add these to your Task list?</p>
                <button
                  type="button"
                  disabled={isGenerating || selectedCount === 0}
                  onClick={addGeneratedTasksToList}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#b39c8a] bg-[#2f241f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#47342b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGenerating ? <Clock3 size={14} className="animate-spin" /> : <ListChecks size={14} />}
                  {isGenerating ? 'Adding to Tasks...' : `Add ${selectedCount} selected task${selectedCount === 1 ? '' : 's'} to my tasks`}
                </button>
                <button
                  type="button"
                  onClick={() => setTasks([])}
                  disabled={isGenerating}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#d8c6b8] bg-white px-4 py-2 text-sm font-semibold text-[#6e5a4b] transition hover:bg-[#fbf8f3] disabled:opacity-60"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {flowStep === 'done' && createdCount > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 rounded-xl border border-[#d9cabb] bg-[#fff8f1] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8ded3] text-[#4a362a]">
                    <Check size={14} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#4a362a]">
                      {createdCount} task{createdCount === 1 ? '' : 's'} added to your Tasks page
                    </p>
                    <p className="text-xs text-[#7d6758]">
                      Ready for scheduling, priority focus, and action.
                    </p>
                  </div>
                </div>

                <Link
                  href="/todo"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#b39c8a] bg-[#2f241f] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#47342b] sm:w-auto"
                >
                  Go to Tasks
                  <ArrowUpRight size={13} />
                </Link>
              </div>

              {closingReflection ? (
                <div className="rounded-xl border border-[#e3d4c7] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7a6557]">Grounding note</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#5e4a3e]">{closingReflection}</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
