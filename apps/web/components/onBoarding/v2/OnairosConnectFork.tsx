'use client';

import React, { useState } from 'react';
import AnimatedOrb from '../new/onboarding-steps/animated-orb';
import OnairosSdkConnector from './OnairosSdkConnector';
import StepFrame from './StepFrame';
import { ObCard, ObButton, ObBadge, ObSpinner } from './ui';

interface OnairosConnectForkProps {
  userEmail?: string | null;
  isAlreadyConnected?: boolean;
  testOnly?: boolean;
  onSuccess: (data: {
    seeded_facts_count?: number;
    recommended_skip_questions?: string[];
    discoveries?: any[];
  }) => void;
  onSkip: () => void;
  /** Called with the raw SDK result before any processing — used by parent debug panels */
  onRawSdkEvent?: (rawResult: unknown) => void;
}

/**
 * OnairosConnectFork — Pre-Onboarding Context Calibration
 *
 * Clean, warm, minimal, serene typography and zero AI-template clutter.
 */
export default function OnairosConnectFork({
  userEmail,
  isAlreadyConnected = false,
  testOnly = false,
  onSuccess,
  onSkip,
  onRawSdkEvent,
}: OnairosConnectForkProps) {
  const [isConnected, setIsConnected] = useState(isAlreadyConnected);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── DEBUG: Capture raw Onairos data for inspection ──
  const [rawOnairosResult, setRawOnairosResult] = useState<any>(null);
  const [constructedPayload, setConstructedPayload] = useState<any>(null);
  const [debugBackendResponse, setDebugBackendResponse] = useState<any>(null);

  React.useEffect(() => {
    setIsConnected(isAlreadyConnected);
  }, [isAlreadyConnected]);

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/onboarding/v2/onairos', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      setIsConnected(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not reset Onairos data');
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Send ingested payload to our backend API for sanitization & context seeding
  const handlePayloadIngest = async (payload: Record<string, unknown>) => {
    console.log('🌐 [OnairosConnectFork] Ingesting Onairos persona payload...');
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/onboarding/v2/onairos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setDebugBackendResponse(data); // DEBUG: capture backend response
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process context.');
      }

      console.log('✅ [OnairosConnectFork] Context seeded successfully:', data);
      setIsConnected(true);
        setIsProcessing(false);
      onSuccess(data);
    } catch (err: any) {
      console.error('❌ [OnairosConnectFork] Ingestion error:', err);
      setErrorMessage(err.message || 'Could not import context. You can continue manually.');
      setIsProcessing(false);
    }
  };

  // Connect with accounts via Onairos SDK
  const handleRealConnectComplete = async (result: any) => {
    console.info('[OnairosConnectFork] SDK flow completed', {
      success: result?.success === true,
      cancelled: result?.cancelled === true,
      hasApiResponse: !!result?.apiResponse,
      connectedSourceCount: Array.isArray(result?.connectedSources)
        ? result.connectedSources.length
        : 0,
      hasToken: Boolean(result?.token),
      hasApiUrl: Boolean(result?.apiUrl),
    });

    setRawOnairosResult(result); // DEBUG: capture raw SDK result
    if (typeof window !== 'undefined') (window as any).__onairos = result;
    // Fire raw event hook immediately — before any processing
    onRawSdkEvent?.(result);

    if (result?.cancelled) {
      console.warn('[OnairosConnectFork] User cancelled the SDK flow');
      return;
    }

    const token = result?.token || 'onairos-live-' + Date.now();
    // Per Onairos docs, canonical field is 'approved' (string[]), 'approvedData' is a legacy alias
    const approved: string[] = result?.approved || result?.approvedData || ['personalization'];

    // ── Step 1: Resolve apiResponse from all known SDK v8 paths ──────────────
    // v8 closes modal on consent and resolves apiResponse asynchronously.
    // Priority order: direct apiResponse → userData.aiData → userDataSummary.aiData
    let apiResponse = result?.apiResponse;

    if (!apiResponse || (typeof apiResponse === 'object' && Object.keys(apiResponse).length === 0)) {
      // Try userData.aiData (some SDK builds put data here)
      if (result?.userData?.aiData && typeof result.userData.aiData === 'object') {
        apiResponse = result.userData.aiData;
        console.log('🔀 [OnairosConnectFork] Resolved apiResponse from result.userData.aiData');
      }
      // Try userDataSummary.aiData
      else if (result?.userDataSummary?.aiData && typeof result.userDataSummary.aiData === 'object') {
        apiResponse = result.userDataSummary.aiData;
        console.log('🔀 [OnairosConnectFork] Resolved apiResponse from result.userDataSummary.aiData');
      }
      // Top-level personality key (some builds flatten it)
      else if (result?.personality && typeof result.personality === 'object') {
        apiResponse = result;
        console.log('🔀 [OnairosConnectFork] Resolved apiResponse from top-level result (flattened)');
      }
    }

    // ── Step 2: Fallback fetch to apiUrl if still empty ───────────────────────
    if ((!apiResponse || Object.keys(apiResponse || {}).length === 0) && result?.apiUrl && result?.token) {
      console.log('🔄 [OnairosConnectFork] apiResponse still empty — attempting fallback POST to:', result.apiUrl);
      try {
        const fallbackRes = await fetch(result.apiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${result.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken: result.token || result.accessToken || '',
            token: result.token || result.accessToken || '',
          }),
        });
        if (fallbackRes.ok) {
          apiResponse = await fallbackRes.json();
          console.log('✅ [OnairosConnectFork] Fallback fetch succeeded:', apiResponse);
        } else {
          const errText = await fallbackRes.text().catch(() => '');
          console.warn('⚠️ [OnairosConnectFork] Fallback fetch returned', fallbackRes.status, errText);
        }
      } catch (fallbackErr) {
        console.warn('⚠️ [OnairosConnectFork] Fallback fetch threw:', fallbackErr);
      }
    }

    console.log('📦 [OnairosConnectFork] Resolved apiResponse (final):', apiResponse);

    const resolvedResponse: Record<string, any> = apiResponse || {};

    // ── Step 3: Extract connectedAccounts from all known paths ────────────────
    const connectedAccounts: string[] =
      (Array.isArray(result?.connectedSources) && result.connectedSources.length > 0
        ? result.connectedSources
        : null) ||
      (Array.isArray(result?.userData?.connectedAccounts) && result.userData.connectedAccounts.length > 0
        ? result.userData.connectedAccounts
        : null) ||
      (Array.isArray(result?.userDataSummary?.connectedAccounts) && result.userDataSummary.connectedAccounts.length > 0
        ? result.userDataSummary.connectedAccounts
        : null) ||
      (Array.isArray(resolvedResponse?.source_platforms) && resolvedResponse.source_platforms.length > 0
        ? resolvedResponse.source_platforms
        : null) ||
      [];

    // ── Step 4: Extract personality — check multiple field names ──────────────
    const rawPersonality =
      resolvedResponse?.personality ||
      resolvedResponse?.traits ||
      resolvedResponse?.big_five ||
      result?.userData?.personality ||
      result?.userDataSummary?.aiData?.personality ||
      null;

    const personality = rawPersonality && typeof rawPersonality === 'object'
      ? rawPersonality
      : null; // null = let backend use defaults, do NOT silently inject fake data

    // ── Step 5: Extract interests (Strict raw mode: NO fallback string generation) ─────────────
    const rawInterests =
      (Array.isArray(resolvedResponse?.interests) && resolvedResponse.interests.length > 0
        ? resolvedResponse.interests
        : null) ||
      (Array.isArray(result?.userData?.interests) && result.userData.interests.length > 0
        ? result.userData.interests
        : null) ||
      null;

    const interests: string[] = rawInterests || [];

    // ── Step 6: Extract sentiment ─────────────────────────────────────────────
    const rawSentiment =
      (Array.isArray(resolvedResponse?.sentiment) && resolvedResponse.sentiment.length > 0
        ? resolvedResponse.sentiment
        : null) ||
      (Array.isArray(result?.userData?.sentiment) && result.userData.sentiment.length > 0
        ? result.userData.sentiment
        : null) ||
      null;

    const sentiment = rawSentiment || [];

    const hasRealData = !!(personality || interests.length > 0 || sentiment.length > 0);
    console.log(`[OnairosConnectFork] hasRealData=${hasRealData}, personality=${!!personality}, interests=${interests.length}, sentiment=${sentiment.length}, connectedAccounts=${connectedAccounts.length}`);

    const payload = {
      token,
      approved,
      // Only send apiResponse fields that actually have data
      apiResponse: {
        ...(personality ? { personality } : {}),
        ...(interests.length > 0 ? { interests } : {}),
        ...(sentiment.length > 0 ? { sentiment } : {}),
        source_platforms: connectedAccounts.length > 0 ? connectedAccounts : [],
        // Carry through raw SDK fields for backend diagnostics
        _sdk_had_apiResponse: !!result?.apiResponse && Object.keys(result.apiResponse || {}).length > 0,
        _sdk_keys: result ? Object.keys(result) : [],
        _resolved_from: !result?.apiResponse && apiResponse ? 'fallback' : 'direct',
      },
    };

    setConstructedPayload(payload); // DEBUG: capture constructed payload
    await handlePayloadIngest(payload);
  };

  return (
    <StepFrame width="md" align="center">
      <div className="flex flex-col items-center space-y-6">
        {/* Retuned Orb */}
        <div className="scale-75 -my-4 transition-transform duration-1000">
          <AnimatedOrb />
        </div>

        {/* Title & Narrative with strict typography tokens */}
        <div className="space-y-2.5 max-w-md mx-auto">
          <p className="text-xs uppercase tracking-[0.16em] text-ob-clay-strong font-semibold font-[family-name:var(--font-ob-body)]">
            Context Calibration
          </p>
          <h1 className="text-4xl md:text-5xl font-[500] tracking-normal leading-[1.1] text-balance text-ob-ink font-[family-name:var(--font-ob-display)]">
            Bring your digital footprint with you.
          </h1>
          <p className="text-base leading-relaxed text-ob-ink-muted font-normal text-pretty font-[family-name:var(--font-ob-body)]">
            Instead of starting from zero, connect your existing platforms to let Force calibrate your personality, interests, and emotional tone in seconds.
          </p>
        </div>

        {/* Primary Connect Option Card */}
        <ObCard layer="surface" className="w-full max-w-md space-y-5 text-left">
          {/* Platform Indicators: All 19 Supported Onairos Connectors */}
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider uppercase text-ob-ink-muted">
              <span>Supported Connectors (19 Sources)</span>
              <span className="text-[10px] text-ob-clay">Zero Fallback Mode</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5 max-h-28 overflow-y-auto px-1 py-1 rounded-xl bg-ob-raised/50 border border-ob-border/50">
              {[
                { name: 'ChatGPT', icon: '💬' },
                { name: 'Claude', icon: '🧠' },
                { name: 'Gemini', icon: '✨' },
                { name: 'Grok', icon: '⚡' },
                { name: 'YouTube', icon: '▶️' },
                { name: 'TikTok', icon: '🎵' },
                { name: 'Instagram', icon: '📸' },
                { name: 'Reddit', icon: '🤖' },
                { name: 'LinkedIn', icon: '💼' },
                { name: 'Pinterest', icon: '📌' },
                { name: 'Spotify', icon: '🎧' },
                { name: 'Bloodwork', icon: '🩸' },
                { name: 'Strava', icon: '🏃' },
                { name: 'ChatGPT Health', icon: '🩺' },
                { name: 'Netflix', icon: '🎬' },
                { name: 'Sephora', icon: '💄' },
                { name: 'Gmail', icon: '✉️' },
                { name: 'Slack', icon: '👥' },
                { name: 'Google (all)', icon: '🔍' },
              ].map((platform) => (
                <ObBadge key={platform.name} variant="neutral" className="text-[10px] py-0.5 px-2">
                  <span>{platform.icon}</span>
                  <span>{platform.name}</span>
                </ObBadge>
              ))}
            </div>
          </div>

          {/* Privacy Note: Inset surface block */}
          <div className="rounded-2xl bg-ob-raised border border-ob-border p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-ob-ink">
              <svg
                className="w-4 h-4 text-ob-clay shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Zero-Password, Read-Only Connection</span>
            </div>
            <p className="text-xs text-ob-ink-muted font-normal leading-relaxed">
              OAuth 2.1 consented signals only. We never access passwords or private messages. Imported traits are stored strictly in your encrypted context and can be revoked anytime.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-ob-danger-soft border border-ob-danger/30 text-ob-danger text-xs">
              {errorMessage}
            </div>
          )}

          {/* ── DEBUG PANEL: Raw Onairos Data Inspector ── */}
          {(rawOnairosResult || constructedPayload || debugBackendResponse) && (
            <div className="w-full space-y-3 rounded-xl border-2 border-dashed border-amber-400/60 bg-amber-950/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">🔍 Debug: Raw Onairos Data (No Fallbacks)</p>
                <button
                  type="button"
                  onClick={() => {
                    const dump = { rawOnairosResult, constructedPayload, debugBackendResponse };
                    navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
                  }}
                  className="px-2 py-0.5 text-[10px] font-semibold uppercase bg-amber-400/20 text-amber-300 rounded border border-amber-400/40 hover:bg-amber-400/30 transition-colors"
                >
                  Copy JSON
                </button>
              </div>

              {/* Status Pills */}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className={`px-2 py-0.5 rounded font-mono ${rawOnairosResult?.apiResponse?.personality || rawOnairosResult?.userData?.personality ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-red-950 text-red-300 border border-red-500/40'}`}>
                  Personality: {rawOnairosResult?.apiResponse?.personality || rawOnairosResult?.userData?.personality ? 'Provided' : 'null'}
                </span>
                <span className={`px-2 py-0.5 rounded font-mono ${Array.isArray(rawOnairosResult?.apiResponse?.interests) && rawOnairosResult.apiResponse.interests.length > 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-neutral-900 text-neutral-400 border border-neutral-700'}`}>
                  Interests: {Array.isArray(rawOnairosResult?.apiResponse?.interests) ? rawOnairosResult.apiResponse.interests.length : 0}
                </span>
                <span className="px-2 py-0.5 rounded font-mono bg-blue-950 text-blue-300 border border-blue-500/40">
                  Platforms: {Array.isArray(rawOnairosResult?.connectedSources) ? rawOnairosResult.connectedSources.join(', ') || 'none' : 'none'}
                </span>
              </div>

              {rawOnairosResult && (
                <details open>
                  <summary className="cursor-pointer text-xs font-semibold text-amber-300 hover:underline">Raw SDK Result</summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-black/60 p-3 text-[10px] leading-relaxed text-green-300 whitespace-pre-wrap break-all">
                    {JSON.stringify(rawOnairosResult, null, 2)}
                  </pre>
                </details>
              )}

              {constructedPayload && (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-amber-300 hover:underline">Constructed Payload (sent to backend)</summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-black/60 p-3 text-[10px] leading-relaxed text-blue-300 whitespace-pre-wrap break-all">
                    {JSON.stringify(constructedPayload, null, 2)}
                  </pre>
                </details>
              )}

              {debugBackendResponse && (
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-amber-300 hover:underline">Backend Response (/api/onboarding/v2/onairos)</summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-black/60 p-3 text-[10px] leading-relaxed text-purple-300 whitespace-pre-wrap break-all">
                    {JSON.stringify(debugBackendResponse, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Connect Action Block */}
          {isProcessing ? (
            <div className="w-full h-12 px-8 rounded-full bg-ob-raised border border-ob-border text-ob-ink-muted text-sm font-medium flex items-center justify-center gap-2.5 font-[family-name:var(--font-ob-body)]">
              <ObSpinner size="sm" />
              <span>Calibrating your context model...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {isConnected && !testOnly && (
                <div className="p-3 rounded-xl bg-ob-success-soft border border-ob-success/30 text-ob-success text-xs font-medium flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span>✓</span>
                    <span>Accounts already connected via Onairos</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="text-ob-danger hover:underline text-xs font-normal cursor-pointer transition-colors shrink-0"
                  >
                    {isDisconnecting ? 'Resetting...' : 'Disconnect & Reset'}
                  </button>
                </div>
              )}

              {/* Wrapped Live Onairos SDK Connector */}
              <div className="w-full">
                <OnairosSdkConnector
                  apiKey={process.env.NEXT_PUBLIC_ONAIROS_API_KEY}
                  userEmail={userEmail}
                  testMode={false}
                  onComplete={handleRealConnectComplete}
                  onError={(err) => setErrorMessage(err?.message || 'Failed to connect accounts')}
                />
              </div>

              {isConnected && (
                <ObButton
                  variant="primary"
                  onClick={onSkip}
                  className="w-full"
                >
                  <span>Continue to Force</span>
                  <span>→</span>
                </ObButton>
              )}
            </div>
          )}
        </ObCard>

        {/* Set up manually: Link button */}
        {!isProcessing && !testOnly && (
          <div className="pt-1">
            <ObButton
              variant="link"
              onClick={onSkip}
            >
              Skip for now & start manually →
            </ObButton>
          </div>
        )}
      </div>
    </StepFrame>
  );
}
