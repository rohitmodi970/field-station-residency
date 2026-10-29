"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Brain, Compass, RefreshCw, Zap, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EnergyBucket } from '@/lib/personalization/types';
import { getBucketLabel } from '@/lib/personalization/bucket';
import { useDashboardPersonalization } from '@/hooks/useDashboardPersonalization';

const BUCKET_OPTIONS: Array<{
  key: EnergyBucket;
  title: string;
  description: string;
  icon: typeof Brain;
}> = [
  {
    key: 'clarity',
    title: 'Seeking clarity',
    description: 'I want to understand what I am feeling and where my thoughts are stuck.',
    icon: Compass,
  },
  {
    key: 'growth',
    title: 'Ready for growth',
    description: 'I want momentum, forward movement, and a practical next step.',
    icon: Target,
  },
  {
    key: 'stability',
    title: 'Craving stability',
    description: 'I want calm, grounding, and emotional steadiness right now.',
    icon: Brain,
  },
];

function LoadingState() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6">
      <Card className="border-dashed border-pink-200/70 bg-pink-50/70 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-pink-900">Preparing your personalized dashboard</CardTitle>
          <CardDescription>
            We are shaping your guidance based on your latest reflection context.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-pink-700/80 dark:text-pink-200/90">
          Loading personalization...
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 md:px-6">
      <Card className="border-pink-200/70 bg-rose-50/70">
        <CardHeader>
          <CardTitle className="text-rose-900">Could not load personalization</CardTitle>
          <CardDescription className="text-rose-700/80">{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRetry} className="bg-rose-600 text-white hover:bg-rose-700">Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BucketSelection({
  onSelect,
  saving,
}: {
  onSelect: (bucket: EnergyBucket) => Promise<boolean>;
  saving: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <div className="mb-6 space-y-2">
        <Badge className="border-pink-200 bg-pink-100 text-pink-700">Personalization setup</Badge>
        <h1 className="text-2xl font-semibold text-pink-950 dark:text-pink-100 md:text-3xl">
          How should Force support you today?
        </h1>
        <p className="text-sm text-pink-800/80 dark:text-pink-100/80 md:text-base">
          Pick one mode. You can update this anytime and we will adapt your dashboard guidance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {BUCKET_OPTIONS.map((option, index) => {
          const Icon = option.icon;
          return (
            <motion.button
              key={option.key}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.06 }}
              className="rounded-2xl border border-pink-200/80 bg-white/85 p-4 text-left shadow-sm transition hover:border-pink-300 hover:shadow-md dark:border-pink-500/40 dark:bg-pink-950/35 dark:hover:border-pink-400"
              onClick={() => void onSelect(option.key)}
              disabled={saving}
            >
              <div className="mb-4 inline-flex rounded-lg bg-pink-100 p-2 text-pink-700 dark:bg-pink-900/50 dark:text-pink-100">
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="mb-1 text-base font-semibold text-pink-950 dark:text-pink-100">{option.title}</h2>
              <p className="text-sm text-pink-800/80 dark:text-pink-100/80">{option.description}</p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function PersonalizedDashboardShell() {
  const { loading, error, state, refresh, saveBucket, savingBucket } = useDashboardPersonalization();

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => void refresh()} />;

  if (!state || state.requiresSelection || !state.bucket || !state.personalization) {
    return <BucketSelection onSelect={saveBucket} saving={savingBucket} />;
  }

  const { bucket, personalization, reflection } = state;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Badge className="border-pink-200 bg-pink-100 text-pink-700">{getBucketLabel(bucket)}</Badge>
          <h1 className="mt-2 text-2xl font-semibold text-pink-950 dark:text-pink-100 md:text-3xl">
            Personalized Dashboard
          </h1>
          <p className="mt-1 text-sm text-pink-800/80 dark:text-pink-100/80">
            Guidance source: {personalization.source} • Prompt: {personalization.promptVersion}
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void refresh()}
          className="inline-flex gap-2 border-pink-300 text-pink-800 hover:bg-pink-50 dark:border-pink-400/50 dark:text-pink-100 dark:hover:bg-pink-900/40"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh insight
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-pink-200/80 bg-white/80 md:col-span-2 dark:border-pink-500/35 dark:bg-pink-950/30">
          <CardHeader>
            <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full bg-pink-100 px-3 py-1 text-xs font-medium text-pink-700 dark:bg-pink-900/60 dark:text-pink-100">
              <Zap className="h-3.5 w-3.5" />
              Current AI spotlight
            </div>
            <CardTitle className="text-pink-950 dark:text-pink-100">{personalization.insight.headline}</CardTitle>
            <CardDescription className="text-pink-800/80 dark:text-pink-100/80">{personalization.insight.insight}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-pink-50 p-3 text-sm text-pink-800 dark:bg-pink-900/40 dark:text-pink-100">
              <strong>Action hint:</strong> {personalization.insight.actionHint}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/journal/new"
                className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
              >
                {personalization.insight.actionLabel}
              </Link>
              <Link
                href="/analysis/entries"
                className="inline-flex items-center justify-center rounded-xl border border-pink-300 px-4 py-2 text-sm font-medium text-pink-800 transition hover:bg-pink-50 dark:border-pink-400/45 dark:text-pink-100 dark:hover:bg-pink-900/40"
              >
                View analysis entries
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-pink-200/80 bg-white/80 dark:border-pink-500/35 dark:bg-pink-950/30">
          <CardHeader>
            <CardTitle className="text-base text-pink-950 dark:text-pink-100">Personal context</CardTitle>
            <CardDescription className="text-pink-800/80 dark:text-pink-100/80">
              Your latest onboarding context used for personalization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-pink-800 dark:text-pink-100/90">
            <div>
              <p className="font-medium text-pink-950 dark:text-pink-100">Energy mode</p>
              <p>{getBucketLabel(bucket)}</p>
            </div>
            <div>
              <p className="font-medium text-pink-950 dark:text-pink-100">Reflection</p>
              <p>{reflection || 'No reflection found yet.'}</p>
            </div>
            <div>
              <p className="font-medium text-pink-950 dark:text-pink-100">Generated</p>
              <p>{new Date(personalization.generatedAt).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
