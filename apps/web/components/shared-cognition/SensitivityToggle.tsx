"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/journal/ui/button2';
import { Shield, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  journalId: string;
  entryId: string;
  initialIsSensitive?: boolean;
}

export function SensitivityToggle({ journalId, entryId, initialIsSensitive = false }: Props) {
  const [isSensitive, setIsSensitive] = useState(initialIsSensitive);
  const [isProcessing, setIsProcessing] = useState(false);

  // In a real app we'd fetch the initial state on mount if not provided
  
  const toggleSensitivity = async () => {
    setIsProcessing(true);
    const endpoint = `/api/journals/${journalId}/entries/${entryId}/sensitive`;
    const method = isSensitive ? 'DELETE' : 'POST';

    try {
      const res = await fetch(endpoint, { method });
      if (res.ok) {
        setIsSensitive(!isSensitive);
        if (!isSensitive) {
          toast.success('Entry marked as sensitive. Any active shared snapshots have been revoked.');
        } else {
          toast.success('Sensitivity tag removed.');
        }
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update sensitivity');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Button
      variant={isSensitive ? "destructive" : "outline"}
      size="sm"
      className={`gap-2 transition-colors duration-300 ${isSensitive ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20' : ''}`}
      onClick={toggleSensitivity}
      disabled={isProcessing}
      title={isSensitive ? "Marked as sensitive (cannot be shared)" : "Mark as sensitive"}
    >
      {isSensitive ? (
        <>
          <ShieldAlert className="w-4 h-4" />
          <span>Sensitive</span>
        </>
      ) : (
        <>
          <Shield className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Standard</span>
        </>
      )}
    </Button>
  );
}
