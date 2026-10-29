"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { BookOpen, ExternalLink } from 'lucide-react';

export interface Grant {
  id: string;
  grant_type: string;
  status: string;
  expires_at: string | null;
  granted_at: string;
  journal_id: string;
  entry_id: string;
  connection_id?: string;
  requires_acceptance: boolean;
  grantee_wrapped_key?: string;
  shared_entry_snapshots?: {
    id: string;
    title_encrypted: string;
    title_iv: string;
    content_encrypted?: string;
    snapshot_at: string;
    topics?: string[];
  }[];
  topics?: string[];
  grantor?: {
    id: string;
    name: string;
    profile_image: string | null;
  };
  grantee?: {
    id: string;
    name: string;
    profile_image: string | null;
  };
}

interface Props {
  grant: Grant;
  onUpdate: () => void;
  isSentByMe?: boolean;
}

export function ConsentGrantCard({ grant, onUpdate, isSentByMe = false }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = async (action: 'accept' | 'decline' | 'revoke') => {
    setIsProcessing(true);
    try {
      const endpoint = action === 'revoke' 
        ? `/api/consent/${grant.id}`
        : `/api/consent/${grant.id}/${action}`;
      
      const method = action === 'revoke' ? 'DELETE' : 'POST';

      const res = await fetch(endpoint, { method });
      if (res.ok) {
        toast.success(`Grant ${action}d`);
        onUpdate();
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${action}`);
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const partner = isSentByMe ? grant.grantee : grant.grantor;
  const partnerName = partner?.name || 'Partner';
  
  const snapshot = grant.shared_entry_snapshots?.[0];
  const snapshotTitle = snapshot?.title_encrypted;
  const displayTitle = (snapshotTitle && snapshotTitle !== 'none') ? snapshotTitle : 'Journal Reflection';

  return (
    <Card className="overflow-hidden rounded-2xl border border-[#E6DFD5] bg-white/80 text-[#2E2012] shadow-[0_8px_24px_rgba(63,43,17,0.08)]">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                isSentByMe 
                  ? 'bg-[#F5EFEB] text-[#7A5A3A]' 
                  : 'bg-[#f8dcc4] text-[#8f4d30]'
              }`}>
                {isSentByMe ? 'You Shared' : `From ${partnerName}`}
              </span>
              {grant.status === 'pending_acceptance' && (
                  <span className="rounded-md bg-[#fbf0df] px-2 py-0.5 text-[10px] font-medium text-[#8f6030]">
                  Needs Approval
                </span>
              )}
              {grant.status === 'active' && (
                  <span className="rounded-md bg-[#e6f3e8] px-2 py-0.5 text-[10px] font-medium text-[#39734b]">
                  Active
                </span>
              )}
            </div>
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-[#2E2012] line-clamp-1">
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#8f4d30]" />
              {displayTitle}
            </h4>
            <p className="text-[11px] text-[#7A5A3A]">
              {new Date(grant.granted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isSentByMe && (grant.status === 'active' || grant.status === 'pending_acceptance') && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-muted-foreground hover:text-destructive text-xs h-7 px-2"
                onClick={() => handleAction('revoke')}
                disabled={isProcessing}
              >
                Revoke
              </Button>
            )}
          </div>
        </div>

        {/* View entry link - opens in new tab */}
        {grant.status === 'active' && (
          <div className="border-t border-[#EAE3D9] pt-2">
            <a
              href={`/shared-entry/${grant.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8f4d30] transition-colors hover:text-[#723c24]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Read Full Entry
            </a>
          </div>
        )}

        {/* Action area for pending grants */}
        {grant.status === 'pending_acceptance' && !isSentByMe && (
          <div className="flex gap-2 pt-2 border-t border-border/50">
            <Button 
              size="sm" 
              onClick={() => handleAction('accept')} 
              disabled={isProcessing}
              className="flex-1 h-8 text-xs font-medium"
            >
              Accept
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => handleAction('decline')} 
              disabled={isProcessing}
              className="flex-1 h-8 text-xs font-medium"
            >
              Decline
            </Button>
          </div>
        )}

        {grant.status === 'pending_acceptance' && isSentByMe && (
          <div className="text-xs text-muted-foreground italic pt-1">
            Awaiting approval from {partnerName}...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
