"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/journal/ui/button2';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Props {
  journalId: string;
  entryId: string;
  isSensitive: boolean;
  onShared?: () => void;
}

export function ShareEntryPanel({ journalId, entryId, isSensitive, onShared }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Fetch active connections
      const fetchConnections = async () => {
        try {
          const res = await fetch('/api/connections');
          if (res.ok) {
            const data = await res.json();
            // Filter only accepted connections
            const active = data.connections.filter((c: any) => c.status === 'accepted');
            setConnections(active);
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchConnections();
    }
  }, [isOpen]);

  const handleShare = async () => {
    if (!selectedConnection) {
      toast.error('Please select a partner');
      return;
    }

    if (isSensitive) {
      toast.error('Cannot share a sensitive entry');
      return;
    }

    setIsProcessing(true);
    try {
      // Find the partner ID (either requester or recipient depending on current user)
      const conn = connections.find(c => c.id === selectedConnection);
      if (!conn) return;

      // Note: In Phase 4.1, this is where we will fetch the partner's public RSA key,
      // generate a random AES-GCM key, encrypt the snapshot with AES,
      // and wrap the AES key with the partner's RSA key.
      // For now, we simulate sending the encrypted payload.
      const simulatedEncryptedPayload = 'simulated_wrapped_key_payload';
      const partnerId = conn.requester_id === conn.recipient.id ? conn.requester.id : conn.recipient.id; // Just need a grantee_id

      const res = await fetch('/api/consent/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantee_id: partnerId,
          connection_id: conn.id,
          grant_type: 'entry_snapshot',
          journal_id: journalId,
          entry_id: entryId,
          grantee_wrapped_key: simulatedEncryptedPayload,
          requires_acceptance: true // We default to requiring acceptance for entry snapshots
        })
      });

      if (res.ok) {
        toast.success('Snapshot shared successfully!');
        setIsOpen(false);
        if (onShared) onShared();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to share');
      }
    } catch (err) {
      toast.error('An error occurred while sharing');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isSensitive}>
          Share Snapshot
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Journal Snapshot</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            Sharing this entry creates a secure, end-to-end encrypted snapshot. The contents are frozen in time and only readable by your partner.
          </p>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Select Partner</label>
            <select 
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
            >
              <option value="" disabled>Select a partner...</option>
              {connections.map(c => (
                <option key={c.id} value={c.id}>
                  {c.requester.name} & {c.recipient.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleShare} disabled={isProcessing || !selectedConnection || isSensitive}>
            {isProcessing ? 'Encrypting...' : 'Share Securely'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
