"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ConnectionUser {
  id: string;
  name: string;
  email: string;
  username: string;
  profile_image: string | null;
}

interface Connection {
  id: string;
  status: 'pending' | 'accepted' | 'declined' | 'blocked' | 'dissolved';
  requested_at: string;
  requester_id: string;
  recipient_id: string;
  requester: ConnectionUser;
  recipient: ConnectionUser;
}

export function ConnectionsPanel({ currentUserId, refreshTrigger }: { currentUserId: string, refreshTrigger: number }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConnections = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections || []);
      }
    } catch (err) {
      console.error('Error fetching connections:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [refreshTrigger]);

  const handleAction = async (action: 'accept' | 'decline' | 'block' | 'dissolve', connectionId: string) => {
    const endpoint = action === 'dissolve' 
      ? `/api/connections/${connectionId}`
      : `/api/connections/${connectionId}/${action}`;
      
    const method = action === 'dissolve' ? 'DELETE' : 'POST';

    try {
      const res = await fetch(endpoint, { method });
      if (res.ok) {
        toast.success(`Connection ${action}ed`);
        fetchConnections();
      } else {
        const data = await res.json();
        toast.error(data.error || `Failed to ${action}`);
      }
    } catch (err) {
      toast.error('An error occurred');
    }
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading...</div>;
  }

  const pendingReceived = connections.filter(c => c.status === 'pending' && c.recipient_id === currentUserId);
  const pendingSent = connections.filter(c => c.status === 'pending' && c.requester_id === currentUserId);
  const activeConnections = connections.filter(c => c.status === 'accepted');

  return (
    <div className="space-y-6">
      {pendingReceived.length > 0 && (
        <Card className="rounded-2xl border-[#E6DFD5] bg-[#F5EFEB]/90 text-[#2E2012] shadow-[0_12px_28px_rgba(63,43,17,0.08)] backdrop-blur-sm">
          <CardHeader className="pb-3 pt-5 sm:px-6">
            <CardTitle className="font-serif text-base font-semibold text-[#2E2012]">Requests</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pb-5 sm:px-6">
            {pendingReceived.map(conn => (
              <div key={conn.id} className="flex flex-col justify-between gap-4 rounded-xl border border-[#E6DFD5] bg-white/70 p-3.5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  {conn.requester?.profile_image ? (
                    <img src={conn.requester.profile_image} alt={conn.requester.name} className="w-10 h-10 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-semibold text-sm">
                      {conn.requester?.name?.charAt(0).toUpperCase() || 'F'}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-[#2E2012]">{conn.requester?.name}</p>
                    <p className="text-xs text-[#7A5A3A]">{conn.requester?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="default" size="sm" onClick={() => handleAction('accept', conn.id)} className="h-8 text-xs px-3">Accept</Button>
                  <Button variant="outline" size="sm" onClick={() => handleAction('decline', conn.id)} className="h-8 text-xs px-3">Decline</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeConnections.length > 0 && (
        <Card className="rounded-2xl border-[#E6DFD5] bg-[#F5EFEB]/90 text-[#2E2012] shadow-[0_12px_28px_rgba(63,43,17,0.08)] backdrop-blur-sm">
          <CardHeader className="pb-3 pt-5 sm:px-6">
            <CardTitle className="font-serif text-base font-semibold text-[#2E2012]">People you’re connected to</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pb-5 sm:px-6">
            {activeConnections.map(conn => {
              const partner = conn.requester_id === currentUserId ? conn.recipient : conn.requester;
              return (
                <div key={conn.id} className="flex flex-col justify-between gap-4 rounded-xl border border-[#E6DFD5] bg-white/70 p-3.5 transition-colors hover:border-[#8f4d30]/50 hover:bg-white sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    {partner?.profile_image ? (
                      <img src={partner.profile_image} alt={partner.name} className="w-11 h-11 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-semibold text-sm">
                        {partner?.name?.charAt(0).toUpperCase() || 'F'}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-[#2E2012]">{partner?.name}</p>
                      <p className="text-xs text-[#7A5A3A]">Connected {new Date(conn.requested_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => window.location.href = `/connections/${conn.id}`}
                      className="h-8 text-xs px-3.5"
                    >
                      Open
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleAction('dissolve', conn.id)}
                      className="h-8 text-xs px-2.5 text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {pendingSent.length > 0 && (
        <Card className="rounded-2xl border-[#E6DFD5] bg-[#F5EFEB]/80 text-[#2E2012] shadow-sm">
          <CardHeader className="pb-3 pt-5 sm:px-6">
            <CardTitle className="font-serif text-base font-semibold text-[#2E2012]">Sent</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pendingSent.map(conn => (
              <div key={conn.id} className="flex items-center justify-between p-3 border border-border rounded-xl bg-muted/40">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-foreground text-sm">{conn.recipient?.name || 'Friend'}</p>
                    <p className="text-xs text-muted-foreground">Waiting for a reply</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">Pending</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {connections.length === 0 && !isLoading && (
        <div className="text-center py-12 px-4 border border-dashed rounded-xl bg-card/40">
          <h3 className="mb-1.5 text-base font-medium text-foreground">No connections yet</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Search for someone above to connect and share journal reflections.
          </p>
        </div>
      )}
    </div>
  );
}
