"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
} from 'lucide-react';
import { Grant } from '@/components/shared-cognition/ConsentGrantCard';
import { ShareJournalModal } from '@/components/shared-cognition/ShareJournalModal';
import { EntriesTab } from '@/components/shared-cognition/EntriesTab';
import { WorkspaceTabs, type WorkspaceTab } from '@/components/shared-cognition/WorkspaceTabs';
import { PromptsTab } from '@/components/shared-cognition/PromptsTab';
import { TopicsTab } from '@/components/shared-cognition/TopicsTab';
import { MobileConnectionHeader } from '@/components/shared-cognition/MobileConnectionHeader';
import { MobileStatusSheet } from '@/components/shared-cognition/MobileStatusSheet';
import { MediationInterventionEntity } from '@/types/mediation-schemas';
import { toast } from 'sonner';
import { ConnectionCard } from '@/components/shared-cognition/ConnectionCard';

interface PartnerInfo {
  id: string;
  name: string;
  email: string;
  username: string;
  profile_image: string | null;
}

interface ConnectionContextData {
  id: string;
  status: string;
  requested_at: string;
  partner: PartnerInfo;
  my_allows_modeling: boolean;
  partner_allows_modeling: boolean;
  both_opted_in: boolean;
}

export default function ConnectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const connectionId = params.id as string;

  const [connData, setConnData] = useState<ConnectionContextData | null>(null);
  const [relationshipContext, setRelationshipContext] = useState<Record<string, any>>({});
  const [receivedGrants, setReceivedGrants] = useState<Grant[]>([]);
  const [sentGrants, setSentGrants] = useState<Grant[]>([]);
  const [interventions, setInterventions] = useState<MediationInterventionEntity[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [togglingConsent, setTogglingConsent] = useState(false);
  const [dissolving, setDissolving] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('entries');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mobileStatusOpen, setMobileStatusOpen] = useState(false);

  const fetchConnectionData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        setCurrentUserId(authData.user.id);
        import('@/utils/encryption/collaborationCrypto')
          .then(({ ensureCollabKeyPair }) => ensureCollabKeyPair(authData.user.id))
          .catch((err) => console.warn('[ConnectionDetail] Collab key bootstrap failed (non-fatal):', err));
      }

      const [contextRes, receivedRes, sentRes, mediationRes] = await Promise.all([
        fetch(`/api/connections/${connectionId}/context`),
        fetch('/api/consent/granted-to-me'),
        fetch('/api/consent/granted-by-me'),
        fetch(`/api/connections/${connectionId}/mediation`),
      ]);

      if (!contextRes.ok || !receivedRes.ok || !sentRes.ok || !mediationRes.ok) {
        throw new Error('Could not load this connection workspace.');
      }

      const data = await contextRes.json();
      setConnData(data.connection);
      setRelationshipContext(data.relationship_context || {});

      const receivedData = await receivedRes.json();
      const sentData = await sentRes.json();
        
        // Filter grants specifically for this connection
        const filteredReceived = (receivedData.grants || []).filter(
          (g: any) => g.connection_id === connectionId
        );
        const filteredSent = (sentData.grants || []).filter(
          (g: any) => g.connection_id === connectionId
        );

      setReceivedGrants(filteredReceived);
      setSentGrants(filteredSent);

      const mediationData = await mediationRes.json();
      setInterventions(mediationData.interventions || []);
    } catch (err) {
      console.error('Failed to load connection data:', err);
      setLoadError(err instanceof Error ? err.message : 'Could not load this connection workspace.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectionData();
  }, [connectionId]);

  const handleEvaluateMediation = async () => {
    if (isEvaluating) return;
    setIsEvaluating(true);
    try {
      const res = await fetch(`/api/connections/${connectionId}/mediation/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerContext: { type: 'manual_request', note: 'User triggered check' } }),
      });
      const data = await res.json();
      if (data.decision?.action === 'silence') {
        toast.info('Everything is peaceful right now. No nudges needed.');
      } else if (data.persisted) {
        toast.success('✨ New check-in prompt created!');
      }
      fetchConnectionData();
    } catch {
      toast.error('Failed to check for prompts');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSimulateScenario = async (scenario: string) => {
    setIsEvaluating(true);
    try {
      const res = await fetch(`/api/connections/${connectionId}/mediation/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      if (data.persisted) {
        toast.success('✨ Demo prompt created!');
      } else {
        toast.info(`Result: ${data.decision?.action || 'silence'}`);
      }
      fetchConnectionData();
    } catch {
      toast.error('Simulation failed');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleToggleConsent = async () => {
    if (!connData || togglingConsent) return;
    setTogglingConsent(true);
    const newSetting = !connData.my_allows_modeling;

    try {
      const res = await fetch(`/api/connections/${connectionId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_modeling: newSetting }),
      });

      if (res.ok) {
        toast.success(
          newSetting
            ? 'AI check-ins enabled for this connection'
            : 'AI check-ins paused'
        );
        fetchConnectionData();
      } else {
        toast.error('Failed to update setting');
      }
    } catch (err) {
      toast.error('Network error updating setting');
    } finally {
      setTogglingConsent(false);
    }
  };

  const handleDissolveConnection = async () => {
    setDissolving(true);
    try {
      const res = await fetch(`/api/connections/${connectionId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Connection removed');
        router.push('/connections');
      } else {
        toast.error('Failed to remove connection');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setDissolving(false);
    }
  };

  const partner = connData?.partner;
  const partnerName = partner?.name || 'Friend';
  const totalShared = receivedGrants.length + sentGrants.length;
  const topics = Array.isArray(relationshipContext.topics?.items)
    ? relationshipContext.topics.items
    : Array.isArray(relationshipContext.shared_topics)
      ? relationshipContext.shared_topics
      : [];
  const connectedSince = connData?.requested_at
    ? new Date(connData.requested_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Recently';

  return (
    <main className="min-h-screen bg-[#FBF7F1] px-4 pb-28 pt-8 text-[#2E2012] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-280">
        <Button
          variant="ghost"
          size="sm"
          className="mb-3 -ml-2 hidden gap-1.5 text-xs text-[#7A5A3A] hover:bg-[#FFFDF9] hover:text-[#9F6958] lg:inline-flex"
          onClick={() => router.push('/connections')}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Connections
        </Button>

        <div className="hidden items-start gap-6 lg:grid lg:grid-cols-[340px_minmax(0,1fr)]">
          {connData ? (
            <ConnectionCard
              name={partnerName}
              email={partner?.email}
              username={partner?.username}
              profileImage={partner?.profile_image}
              connectedSince={connectedSince}
              enabledByMe={connData.my_allows_modeling}
              enabledByPartner={connData.partner_allows_modeling}
              isUpdating={togglingConsent}
              isRemoving={dissolving}
              onShare={() => setIsShareModalOpen(true)}
              onToggleCheckIns={handleToggleConsent}
              onRemove={handleDissolveConnection}
            />
          ) : (
            <div className="h-96 animate-pulse rounded-2xl bg-[#F4EDE2]" />
          )}

          <section className="min-w-0 rounded-2xl border border-[#E6DFD5] bg-[#F4EDE2] p-4 shadow-[0_12px_32px_rgba(63,43,17,0.08)] sm:p-5">
        {isLoading ? (
          <div className="space-y-4" aria-label="Loading connection workspace">
            <div className="h-10 animate-pulse rounded-lg bg-[#E9DDCF]" />
            <div className="h-24 animate-pulse rounded-xl bg-[#FFFDF9]" />
            <div className="h-24 animate-pulse rounded-xl bg-[#FFFDF9]" />
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-dashed border-[#D7C8B8] bg-[#FFFDF9] px-6 py-12 text-center">
            <p className="font-serif text-base text-[#2E2012]">Could not load this workspace</p>
            <p className="mt-1 text-xs text-[#7A5A3A]">{loadError}</p>
            <Button onClick={fetchConnectionData} variant="outline" size="sm" className="mt-4 border-[#D7C8B8] text-xs text-[#9F6958] hover:bg-[#F4EDE2]">Try again</Button>
          </div>
        ) : (
          <WorkspaceTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={{ entries: totalShared, prompts: interventions.length, topics: topics.length }}
          >
            {activeTab === 'entries' && (
              <div id="entries-panel" role="tabpanel" aria-labelledby="entries-tab">
                <EntriesTab
                  sentGrants={sentGrants}
                  receivedGrants={receivedGrants}
                  partnerName={partnerName}
                  onUpdate={fetchConnectionData}
                />
              </div>
            )}

            {activeTab === 'prompts' && <div id="prompts-panel" role="tabpanel" aria-labelledby="prompts-tab" className="space-y-4">
              <PromptsTab connectionId={connectionId} currentUserId={currentUserId} partnerName={partnerName} enabledByMe={connData?.my_allows_modeling ?? false} enabledByPartner={connData?.partner_allows_modeling ?? false} interventions={interventions} isEvaluating={isEvaluating} onToggleConsent={handleToggleConsent} onEvaluate={handleEvaluateMediation} onSimulate={handleSimulateScenario} onStatusChange={fetchConnectionData} />
            </div>}

            {activeTab === 'topics' && <div id="topics-panel" role="tabpanel" aria-labelledby="topics-tab" className="space-y-4">
              <TopicsTab topics={topics} />
            </div>}
          </WorkspaceTabs>
        )}
          </section>
        </div>

        <div className="lg:hidden">
          <MobileConnectionHeader name={partnerName} profileImage={partner?.profile_image} isRemoving={dissolving} onRemove={handleDissolveConnection} />
          <div className="px-1 pb-24 pt-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 title={partnerName} className="truncate font-serif text-2xl text-[#2E2012]">{partnerName}</h1>
                <span className="mt-2 inline-flex rounded-full border border-[#D7C8B8] bg-[#FFFDF9] px-2.5 py-1 text-[11px] font-medium text-[#7A5A3A]">Connected since {connectedSince}</span>
              </div>
            </div>

            <button type="button" onClick={() => setMobileStatusOpen(true)} className="mb-4 flex w-full items-center justify-between rounded-xl border border-[#E6DFD5] bg-[#F4EDE2] p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F6958]">
              <span className="text-xs text-[#7A5A3A]">Private by default · Check-ins {connData?.my_allows_modeling && connData.partner_allows_modeling ? 'active' : 'off'}</span>
              <span className="text-xs font-medium text-[#9F6958]">Details</span>
            </button>

            {isLoading ? (
              <div className="space-y-3" aria-label="Loading connection workspace">
                <div className="h-11 animate-pulse rounded-xl bg-[#E9DDCF]" />
                <div className="h-28 animate-pulse rounded-xl bg-[#FFFDF9]" />
                <div className="h-28 animate-pulse rounded-xl bg-[#FFFDF9]" />
              </div>
            ) : loadError ? (
              <div className="rounded-xl border border-dashed border-[#D7C8B8] bg-[#FFFDF9] px-5 py-10 text-center">
                <p className="font-serif text-base text-[#2E2012]">Could not load this workspace</p>
                <p className="mt-1 text-xs text-[#7A5A3A]">{loadError}</p>
                <Button onClick={fetchConnectionData} variant="outline" size="sm" className="mt-4 border-[#D7C8B8] text-xs text-[#9F6958]">Try again</Button>
              </div>
            ) : (
              <div className="-mx-1">
                <div className="sticky top-14 z-30 bg-[#FBF7F1]">
                  <WorkspaceTabs activeTab={activeTab} onTabChange={setActiveTab} counts={{ entries: totalShared, prompts: interventions.length, topics: topics.length }}>
                    {activeTab === 'entries' && <EntriesTab sentGrants={sentGrants} receivedGrants={receivedGrants} partnerName={partnerName} onUpdate={fetchConnectionData} mobile />}
                    {activeTab === 'prompts' && <PromptsTab connectionId={connectionId} currentUserId={currentUserId} partnerName={partnerName} enabledByMe={connData?.my_allows_modeling ?? false} enabledByPartner={connData?.partner_allows_modeling ?? false} interventions={interventions} isEvaluating={isEvaluating} onToggleConsent={handleToggleConsent} onEvaluate={handleEvaluateMediation} onSimulate={handleSimulateScenario} onStatusChange={fetchConnectionData} />}
                    {activeTab === 'topics' && <TopicsTab topics={topics} />}
                  </WorkspaceTabs>
                </div>
              </div>
            )}
          </div>
          <Button onClick={() => setIsShareModalOpen(true)} className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 h-11 bg-[#9F6958] text-sm font-medium text-white shadow-[0_8px_24px_rgba(63,43,17,0.18)] hover:bg-[#865545]">Share entry</Button>
          <MobileStatusSheet open={mobileStatusOpen} partnerName={partnerName} enabledByMe={connData?.my_allows_modeling ?? false} enabledByPartner={connData?.partner_allows_modeling ?? false} isUpdating={togglingConsent} onToggleCheckIns={handleToggleConsent} onClose={() => setMobileStatusOpen(false)} />
        </div>
      </div>

      {/* Share Journal Modal */}
      {connData?.partner && (
        <ShareJournalModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          connectionId={connectionId}
          partnerId={connData.partner.id}
          partnerName={partnerName}
          onShared={fetchConnectionData}
        />
      )}
    </main>
  );
}
