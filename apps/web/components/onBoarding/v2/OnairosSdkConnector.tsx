'use client';

import '@/utils/react19-polyfill';
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'onairos/onairos.css';
import { ObSpinner } from './ui';

import { initOnairosWebSdk, exportOnairosData, OnairosExportedData } from '@/lib/onairos';

export const ALL_ONAIROS_CONNECTORS = [
  'chatgpt',
  'claude',
  'gemini',
  'grok',
  'youtube',
  'tiktok',
  'instagram',
  'reddit',
  'linkedin',
  'pinterest',
  'spotify',
  'bloodwork',
  'strava',
  'chatgpt_health',
  'netflix',
  'sephora',
  'gmail',
  'slack',
  'google-all',
];

interface OnairosSdkConnectorProps {
  apiKey?: string | null;
  userEmail?: string | null;
  testMode?: boolean;
  allowedPlatforms?: string[] | null;
  webpageName?: string;
  requestData?: Record<string, { type: string; reward: string }> | string[];
  buttonText?: string;
  onComplete: (data: any, exported?: OnairosExportedData) => void;
  onError?: (err: any) => void;
}

// Dynamically import OnairosButton so it only evaluates on the client side 
const DynamicOnairosButton = dynamic(
  () => import('onairos').then((mod) => mod.OnairosButton),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-12 px-8 rounded-full bg-ob-surface border border-ob-border text-ob-ink-muted text-sm font-medium flex items-center justify-center gap-2.5 animate-pulse font-[family-name:var(--font-ob-body)]">
        <ObSpinner size="sm" />
        <span>Loading connectors...</span>
      </div>
    ),
  }
);

export default function OnairosSdkConnector({
  apiKey,
  userEmail: propEmail,
  testMode = false,
  allowedPlatforms = null,
  webpageName = 'Force',
  requestData = {
    personality: { type: 'personality', reward: 'Personalized experience' },
  },
  buttonText,
  onComplete,
  onError,
}: OnairosSdkConnectorProps) {
  const [isReady, setIsReady] = useState(false);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const resolvedKey =
    apiKey ||
    process.env.NEXT_PUBLIC_ONAIROS_API_KEY ||
    process.env.ONAIROS_API_KEY ||
    '';

  useEffect(() => {
    let active = true;

    if (!resolvedKey) {
      setConfigurationError('Onairos is not configured for this deployment.');
      setIsReady(false);
      return () => {
        active = false;
      };
    }

    // Safety timeout: never hang on 'Preparing connectors...' for more than 2 seconds
    const timeoutId = setTimeout(() => {
      if (active) setIsReady(true);
    }, 2000);

    initOnairosWebSdk({
      apiKey: resolvedKey,
      environment: 'production',
      enableLogging: false,
    })
      .then(() => {
        if (active) {
          clearTimeout(timeoutId);
          setIsReady(true);
        }
      })
      .catch((err) => {
        console.warn('⚠️ [OnairosSdkConnector] initializeApiKey note:', err);
        if (active) {
          clearTimeout(timeoutId);
          // If in test mode or soft failure, still allow rendering so user isn't blocked
          setIsReady(true);
        }
      });

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [resolvedKey]);

  if (configurationError) {
    return (
      <div className="w-full rounded-2xl border border-ob-border bg-ob-surface px-5 py-4 text-center text-sm text-ob-ink-muted">
        {configurationError}
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="w-full h-12 px-8 rounded-full bg-ob-surface border border-ob-border text-ob-ink-muted text-sm font-medium flex items-center justify-center gap-2.5 font-[family-name:var(--font-ob-body)]">
        <ObSpinner size="sm" />
        <span>Preparing connectors...</span>
      </div>
    );
  }

  return (
    <div className="onairos-sdk-button-wrapper w-full flex items-center justify-center [&_button]:!w-full [&_button]:!h-12 [&_button]:!px-8 [&_button]:!rounded-full [&_button]:!font-medium [&_button]:!text-[15px] [&_button]:!bg-ob-ink [&_button]:hover:!bg-ob-ink-hover [&_button]:!text-white [&_button_*]:!text-white [&_button_span]:!text-white [&_button]:!transition-all [&_button]:active:scale-[0.98] [&_button]:!shadow-sm [&_button]:!border-0 [&_button]:cursor-pointer [&>button]:!w-full [&>button]:!h-12 [&>button]:!px-8 [&>button]:!rounded-full [&>button]:!font-medium [&>button]:!text-[15px] [&>button]:!bg-ob-ink [&>button]:hover:!bg-ob-ink-hover [&>button]:!text-white [&>button_*]:!text-white [&>button]:!transition-all [&>button]:active:scale-[0.98] [&>button]:!shadow-sm [&>button]:!border-0 [&>button]:cursor-pointer">
      <style>{`
        .onairos-sdk-button-wrapper button,
        .onairos-sdk-button-wrapper button *,
        .onairos-sdk-button-wrapper button span,
        .onairos-sdk-button-wrapper button p {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }
      `}</style>
      <DynamicOnairosButton
        apiKey={resolvedKey}
        preVerifiedEmail={propEmail || undefined}
        webpageName={webpageName}
        requestData={requestData}
        allowedPlatforms={allowedPlatforms || undefined}
        autoFetch={true}
        trainingScreenMode="fast"  // v8 default; waits for one foreground trait chunk
        closeOnConsent={false}     // Wait for autoFetch to complete before onComplete fires
        testMode={testMode}
        buttonType="pill"
        buttonText={buttonText || (testMode ? "Connect Accounts (Test Mode)" : "Connect Accounts")}
        textColor="white"
        onComplete={async (result: any) => {
          if (typeof window !== 'undefined') (window as any).__onairos = result;
          // Automatically extract and export consented data (per llm.txt §1)
          try {
            const exported = await exportOnairosData(result);
            onComplete(result, exported);
          } catch (exportErr) {
            console.warn("[OnairosSdkConnector] exportOnairosData fallback note:", exportErr);
            onComplete(result);
          }
        }}
        onError={onError}
      />
    </div>
  );
}
