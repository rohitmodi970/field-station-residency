"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { BookOpen, Calendar, Check, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface JournalItem {
  id: string;
  journal_id?: string;
  title: string;
  content?: string;
  created_at: string;
  display_date?: string;
}

interface ShareJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  partnerId: string;
  partnerName: string;
  onShared?: () => void;
}

export function ShareJournalModal({
  isOpen,
  onClose,
  connectionId,
  partnerId,
  partnerName,
  onShared,
}: ShareJournalModalProps) {
  const [journals, setJournals] = useState<JournalItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [partnerHasKey, setPartnerHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (partnerId) {
      fetch(`/api/user/public-key?userId=${partnerId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          setPartnerHasKey(Boolean(data?.collaboration_public_key));
        })
        .catch(() => setPartnerHasKey(false));
    }

    const fetchJournals = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/journals?limit=30&sortBy=created_at&sortOrder=desc');
        if (res.ok) {
          const json = await res.json();
          const items: any[] = json.data || json.journals || [];

          // Decrypt titles and contents client-side if available
          let decryptedItems: JournalItem[] = [];
          try {
            const userResp = await fetch('/api/user/current');
            const userJson = await userResp.json();
            const currentUserId = userJson?.user?.id;

            if (currentUserId) {
              import('@/utils/encryption/collaborationCrypto')
                .then(({ ensureCollabKeyPair }) => ensureCollabKeyPair(currentUserId))
                .catch((e) => console.warn('Could not bootstrap sender collab key:', e));

              const { decryptJournalEntry } = await import('@/utils/encryption/journalEncryption');
              decryptedItems = await Promise.all(
                items.map(async (item) => {
                  if (item.title_encrypted || item.content_encrypted) {
                    try {
                      const dec = await decryptJournalEntry({
                        title_encrypted: item.title_encrypted,
                        title_iv: item.title_iv,
                        content_encrypted: item.content_encrypted,
                        content_iv: item.content_iv,
                        date: item.date || item.created_at || '',
                        is_favorite: item.is_favorite || false,
                        is_archived: item.is_archived || false,
                      }, currentUserId);
                      return {
                        ...item,
                        title: dec.title || 'Untitled Reflection',
                        content: dec.content || '',
                      };
                    } catch {
                      return {
                        ...item,
                        title: item.title || 'Untitled Reflection',
                        content: item.content || '',
                      };
                    }
                  }
                  return {
                    ...item,
                    title: item.title || 'Untitled Reflection',
                    content: item.content || '',
                  };
                })
              );
            } else {
              decryptedItems = items;
            }
          } catch (decErr) {
            console.warn('Could not decrypt journal list in modal:', decErr);
            decryptedItems = items;
          }

          setJournals(decryptedItems);
          if (decryptedItems.length > 0) {
            setSelectedJournalId(decryptedItems[0]?.id ?? null);
          }
        } else {
          toast.error('Could not load journals');
        }
      } catch (err) {
        console.error('Error fetching journals:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJournals();
  }, [isOpen]);

  const handleShare = async () => {
    if (!selectedJournalId) {
      toast.error('Please select an entry to share');
      return;
    }

    const selected = journals.find((j) => j.id === selectedJournalId);
    if (!selected) return;

    setIsSharing(true);

    try {
      // 1. Fetch current user
      const userResp = await fetch('/api/user/current');
      const userJson = await userResp.json();
      const currentUserId = userJson?.user?.id;
      if (!currentUserId) {
        toast.error('You must be signed in to share an entry.');
        setIsSharing(false);
        return;
      }

      // 2. Fetch partner's public key
      const keyRes = await fetch(`/api/user/public-key?userId=${partnerId}`);
      if (!keyRes.ok) {
        toast.error(`Could not retrieve ${partnerName}'s public key.`);
        setIsSharing(false);
        return;
      }
      const keyData = await keyRes.json();
      if (!keyData.collaboration_public_key) {
        setPartnerHasKey(false);
        toast.error(
          `${partnerName} hasn't set up secure sharing yet. They need to log in to generate their security keys.`
        );
        setIsSharing(false);
        return;
      }

      const {
        ensureCollabKeyPair,
        importPublicKey,
        wrapAesKeyForUser,
      } = await import('@/utils/encryption/collaborationCrypto');
      const { encryptText } = await import('@/utils/encryption/crypto');

      // 3. Ensure sender has a collab keypair (for self-unwrapping)
      const senderKeyPair = await ensureCollabKeyPair(currentUserId);
      const recipientPublicKey = await importPublicKey(keyData.collaboration_public_key);

      // 4. Generate fresh 32-byte AES snapshot key
      const snapshotAesRaw = crypto.getRandomValues(new Uint8Array(32));
      const snapshotAesKey = await crypto.subtle.importKey(
        'raw',
        snapshotAesRaw,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      // 5. Encrypt title and content with the snapshot key
      const titleToShare = selected.title || 'Shared Reflection';
      const contentToShare = selected.content || '';

      const encTitle = await encryptText(titleToShare, snapshotAesKey);
      const encContent = await encryptText(contentToShare, snapshotAesKey);

      // 6. Wrap the snapshot AES key for both grantee and grantor
      const granteeWrapped = await wrapAesKeyForUser(snapshotAesRaw, recipientPublicKey);
      const grantorWrapped = await wrapAesKeyForUser(snapshotAesRaw, senderKeyPair.publicKey);

      const wrappedPayload = JSON.stringify({
        grantee: granteeWrapped,
        grantor: grantorWrapped,
      });

      // 7. Send to /api/consent/grant
      const res = await fetch('/api/consent/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: connectionId,
          grantee_id: partnerId,
          grant_type: 'entry_snapshot',
          journal_id: selected.journal_id || selected.id,
          entry_id: selected.id,
          title: titleToShare,
          title_encrypted: encTitle.ciphertext,
          title_iv: encTitle.iv,
          content_encrypted: encContent.ciphertext,
          content_iv: encContent.iv,
          grantee_wrapped_key: wrappedPayload,
          requires_acceptance: false,
        }),
      });

      if (res.ok) {
        toast.success(`Entry shared with ${partnerName}!`);
        onClose();
        if (onShared) onShared();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to share entry');
      }
    } catch (err: any) {
      console.error('Error sharing entry:', err);
      toast.error(err?.message || 'Network error sharing entry');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Share a Journal with {partnerName}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Sharing creates a secure snapshot of this entry for {partnerName}. Your other private journal entries remain strictly confidential.
          </DialogDescription>
        </DialogHeader>

        <div className="py-3">
          {partnerHasKey === false && (
            <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  {partnerName} hasn&apos;t enabled secure sharing yet
                </p>
                <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 mt-0.5 leading-relaxed">
                  To receive zero-knowledge encrypted entries, {partnerName} simply needs to log in and visit their Connections page once.
                </p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
              Loading your journals...
            </div>
          ) : journals.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-zinc-400 dark:text-zinc-600" />
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No journal entries found</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Write an entry in your diary first to share it here.</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {journals.map((journal) => {
                const isSelected = selectedJournalId === journal.id;
                const formattedDate = new Date(
                  journal.display_date || journal.created_at
                ).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <div
                    key={journal.id}
                    onClick={() => setSelectedJournalId(journal.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-zinc-900 dark:text-zinc-100 shadow-sm ring-1 ring-indigo-500/20'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-100">
                        {journal.title || 'Untitled Reflection'}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSharing}
            className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleShare}
            disabled={isSharing || !selectedJournalId || journals.length === 0 || partnerHasKey === false}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-md font-medium disabled:opacity-50"
          >
            {isSharing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Share with {partnerName}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
