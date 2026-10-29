"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTheme } from '@/utilities/context/ThemeContext';
import { BookOpen, ArrowLeft, Calendar, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SharedEntry {
  title: string;
  content: string;
  shared_at: string;
  grantor_name: string;
  is_owner?: boolean;
}

export default function SharedEntryPage() {
  const params = useParams();
  const grantId = params.grantId as string;
  const { isDarkMode } = useTheme();
  const [entry, setEntry] = useState<SharedEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntry = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/consent/${grantId}/view`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Could not load entry');
          return;
        }

        const data = await res.json();
        const rawEntry = data.entry;

        if (!rawEntry) {
          setError('Entry not found');
          return;
        }

        if (rawEntry.is_encrypted && rawEntry.grantee_wrapped_key) {
          try {
            // 1. Get current logged in user
            const userResp = await fetch('/api/user/current');
            const userJson = await userResp.json();
            const currentUserId = userJson?.user?.id;

            if (!currentUserId) {
              setError('You must be signed in to view this entry.');
              return;
            }

            // 2. Load collaboration private key for current user
            const { loadCollabPrivateKey, unwrapAesKey, ensureCollabKeyPair } = await import('@/utils/encryption/collaborationCrypto');
            const { decryptText } = await import('@/utils/encryption/crypto');

            let privateKey = await loadCollabPrivateKey(currentUserId);
            if (!privateKey) {
              // Ensure keypair exists or load
              const pair = await ensureCollabKeyPair(currentUserId);
              privateKey = pair.privateKey;
            }

            if (!privateKey) {
              setError('Could not access encryption keys on this device.');
              return;
            }

            // 3. Parse grantee_wrapped_key (handles JSON { grantee, grantor } and legacy raw string)
            let wrappedKeyToUse = rawEntry.grantee_wrapped_key;
            const isOwner = currentUserId === rawEntry.grantor_id;
            try {
              const parsed = JSON.parse(rawEntry.grantee_wrapped_key);
              if (parsed && typeof parsed === 'object') {
                wrappedKeyToUse = isOwner ? (parsed.grantor || parsed.grantee) : parsed.grantee;
              }
            } catch {
              // raw base64 string
              wrappedKeyToUse = rawEntry.grantee_wrapped_key;
            }

            // 4. Unwrap AES key
            const snapshotAesKey = await unwrapAesKey(wrappedKeyToUse, privateKey);

            // 5. Decrypt title and content
            let decTitle = rawEntry.title || 'Shared Reflection';
            let decContent = '';

            if (rawEntry.title_encrypted && rawEntry.title_iv && rawEntry.title_iv !== 'none') {
              decTitle = await decryptText(rawEntry.title_encrypted, rawEntry.title_iv, snapshotAesKey);
            }
            if (rawEntry.content_encrypted && rawEntry.content_iv && rawEntry.content_iv !== 'none') {
              decContent = await decryptText(rawEntry.content_encrypted, rawEntry.content_iv, snapshotAesKey);
            }

            setEntry({
              title: decTitle || 'Shared Reflection',
              content: decContent,
              shared_at: rawEntry.shared_at,
              grantor_name: rawEntry.grantor_name,
              is_owner: isOwner,
            });
          } catch (decErr: any) {
            console.error('Failed to decrypt shared entry:', decErr);
            setError('Could not decrypt shared entry. This entry may have been encrypted for a different key or device.');
          }
        } else {
          // Plaintext / legacy entry
          setEntry({
            title: rawEntry.title || 'Shared Reflection',
            content: rawEntry.content || '',
            shared_at: rawEntry.shared_at,
            grantor_name: rawEntry.grantor_name,
          });
        }
      } catch (err) {
        setError('Network error loading entry');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntry();
  }, [grantId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card pt-8 pb-6 px-6 sm:px-10 lg:px-16">
        <div className="max-w-3xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground text-xs gap-1.5"
            onClick={() => window.close()}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Close
          </Button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Shared Entry
              </h1>
              {entry && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shared by {entry.grantor_name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 sm:px-10 lg:px-16 py-8">
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Loading shared entry...
          </div>
        ) : error ? (
          <div className="text-center py-16 space-y-3">
            <Shield className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : entry ? (
          <div className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground leading-tight">
                {entry.title}
              </h2>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(entry.shared_at).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                  Read-Only
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Body */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="text-sm text-foreground leading-[1.8] whitespace-pre-wrap">
                {entry.content}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-6 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                {entry.is_owner
                  ? 'This is your shared entry with your connection. It is read-only in this view.'
                  : `This entry was shared with you by ${entry.grantor_name}. It is read-only and cannot be edited.`}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
