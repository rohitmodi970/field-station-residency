"use client";

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface UserSearchResult {
  id: string;
  name: string;
  email: string;
  username: string;
  profile_image: string | null;
}

export function UserSearch({ onConnectionRequested }: { onConnectionRequested?: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  useEffect(() => {
    const searchUsers = async () => {
      if (query.length < 3) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.users || []);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 500);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  const handleRequestConnection = async (userId: string) => {
    setRequestingId(userId);
    try {
      const res = await fetch('/api/connections/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: userId })
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Connection request sent');
        setQuery('');
        setResults([]);
        if (onConnectionRequested) onConnectionRequested();
      } else {
        toast.error(data.error || 'Failed to send request');
      }
    } catch (err) {
      toast.error('An error occurred');
    } finally {
      setRequestingId(null);
    }
  };

  return (
    <Card className="w-full rounded-2xl border-[#E6DFD5] bg-[#F5EFEB]/90 text-[#2E2012] shadow-[0_12px_28px_rgba(63,43,17,0.08)] backdrop-blur-sm">
      <CardHeader className="pb-3 pt-5 sm:px-6">
        <CardTitle className="font-serif text-base font-semibold tracking-tight text-[#2E2012]">Find someone</CardTitle>
      </CardHeader>
      <CardContent className="pb-5 sm:px-6">
        <div className="flex flex-col gap-4">
          <Input 
            placeholder="Search by name, username, or email" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 w-full rounded-xl border-[#E6DFD5] bg-white/70 px-4 text-[#2E2012] shadow-xs placeholder:text-[#A68664] focus-visible:border-[#8f4d30]/60 focus-visible:ring-[#8f4d30]/20"
          />
          
          {isLoading && <div className="py-2 text-xs text-[#7A5A3A]">Searching...</div>}
          
          {!isLoading && results.length > 0 && (
            <div className="flex flex-col gap-2.5 mt-1">
              {results.map(user => (
                <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E6DFD5] bg-white/70 p-3 transition-colors hover:border-[#8f4d30]/40 hover:bg-white">
                  <div className="flex items-center gap-3">
                    {user.profile_image ? (
                      <img src={user.profile_image} alt={user.name} className="w-10 h-10 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-semibold text-sm">
                        {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-[#2E2012]">{user.name}</p>
                      <p className="text-xs text-[#7A5A3A]">{user.username ? `@${user.username}` : user.email}</p>
                    </div>
                  </div>
                  <Button 
                    variant="default" 
                    size="sm"
                    disabled={requestingId === user.id}
                    onClick={() => handleRequestConnection(user.id)}
                    className="text-xs h-8 px-3"
                  >
                    {requestingId === user.id ? 'Sending...' : 'Connect'}
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          {!isLoading && query.length >= 3 && results.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#D7C8B8] py-6 text-center text-xs text-[#7A5A3A]">
              No matches found.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
