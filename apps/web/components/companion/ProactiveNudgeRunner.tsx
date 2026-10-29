'use client';

import { useProactiveNudgeTrigger } from '@/hooks/useProactiveNudgeTrigger';

export function ProactiveNudgeRunner() {
  useProactiveNudgeTrigger();
  return null;
}
