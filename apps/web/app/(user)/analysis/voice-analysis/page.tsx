"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VoiceAnalysisRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/analysis/audio-analysis');
  }, [router]);
  return null;
}