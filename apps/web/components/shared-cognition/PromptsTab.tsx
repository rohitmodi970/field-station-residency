"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediationCard } from "@/components/shared-cognition/MediationCard";
import type { MediationInterventionEntity } from "@/types/mediation-schemas";

interface PromptsTabProps {
  connectionId: string;
  currentUserId: string;
  partnerName: string;
  enabledByMe: boolean;
  enabledByPartner: boolean;
  interventions: MediationInterventionEntity[];
  isEvaluating: boolean;
  onToggleConsent: () => void;
  onEvaluate: () => void;
  onSimulate: (scenario: string) => void;
  onStatusChange: () => void;
}

export function PromptsTab({
  connectionId,
  currentUserId,
  partnerName,
  enabledByMe,
  enabledByPartner,
  interventions,
  isEvaluating,
  onToggleConsent,
  onEvaluate,
  onSimulate,
  onStatusChange,
}: PromptsTabProps) {
  const [demoOpen, setDemoOpen] = useState(false);
  const bothEnabled = enabledByMe && enabledByPartner;
  const partnerFirstName = partnerName.split(" ")[0] || partnerName;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-[#EAE1D6] pb-3">
        <div>
          <h2 className="font-serif text-base text-[#2E2012]">Prompts from Force</h2>
          <p className="mt-1 text-xs text-[#7A5A3A]">Gentle questions based on what you choose to share.</p>
        </div>
        {bothEnabled && (
          <Button onClick={onEvaluate} disabled={isEvaluating} variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 border-[#D7C8B8] text-xs text-[#9F6958] hover:bg-[#F4EDE2]">
            <Sparkles className="h-3.5 w-3.5" /> {isEvaluating ? "Checking..." : "Check now"}
          </Button>
        )}
      </div>

      {!bothEnabled ? (
        <div className="rounded-xl border border-dashed border-[#D7C8B8] bg-[#FFFDF9] px-5 py-6">
          <p className="font-serif text-base text-[#2E2012]">Turn on check-ins together</p>
          <p className="mt-1 max-w-lg text-xs leading-5 text-[#7A5A3A]">Force can create prompts after both people enable check-ins.</p>
          <div className="mt-4 grid max-w-sm grid-cols-2 gap-2 text-[11px] text-[#7A5A3A]">
            <div className="rounded-lg border border-[#E6DFD5] bg-[#F4EDE2] px-3 py-2">You: <strong className="text-[#2E2012]">{enabledByMe ? "On" : "Off"}</strong></div>
            <div className="rounded-lg border border-[#E6DFD5] bg-[#F4EDE2] px-3 py-2">{partnerFirstName}: <strong className="text-[#2E2012]">{enabledByPartner ? "On" : "Off"}</strong></div>
          </div>
          <p className="mt-3 text-xs text-[#8B7665]">{enabledByMe ? `Waiting for ${partnerFirstName}.` : "Enable your side to get started."}</p>
          <Button onClick={onToggleConsent} size="sm" className="mt-4 h-8 bg-[#9F6958] text-xs text-white hover:bg-[#865545]">
            {enabledByMe ? "Turn off check-ins" : "Enable check-ins"}
          </Button>
        </div>
      ) : interventions.length > 0 ? (
        <div className="space-y-3">
          {interventions.map((item) => (
            <MediationCard key={item.id} connectionId={connectionId} intervention={item} currentUserId={currentUserId} onStatusChange={onStatusChange} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#D7C8B8] bg-[#FFFDF9] px-5 py-8 text-center">
          <p className="font-serif text-base text-[#2E2012]">Everything is peaceful</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#7A5A3A]">No prompts are needed right now.</p>
        </div>
      )}

      {process.env.NODE_ENV !== "production" && (
        <div className="border-t border-[#EAE1D6] pt-3">
          <button type="button" onClick={() => setDemoOpen((open) => !open)} className="flex items-center gap-1 text-[11px] text-[#8B7665] hover:text-[#9F6958]">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${demoOpen ? "rotate-180" : ""}`} /> Demo tools
          </button>
          {demoOpen && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => onSimulate("work_life_asymmetry")} disabled={isEvaluating} className="h-7 border-[#D7C8B8] text-[11px] text-[#7A5A3A]">Work/life demo</Button>
              <Button variant="outline" size="sm" onClick={() => onSimulate("decision_pace_friction")} disabled={isEvaluating} className="h-7 border-[#D7C8B8] text-[11px] text-[#7A5A3A]">Decision pace demo</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
