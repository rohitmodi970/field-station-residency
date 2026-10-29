import { useEffect, useState } from 'react';
import { isEncryptionInitialized, getEncryptionKey } from '@/utils/encryption/keyManager';
import { encryptText, decryptText } from '@/utils/encryption/crypto';

export interface TranscriptSourceInput {
  recordedVoiceFile: File | null;
  recordedVoiceUrl: string | null;
  voiceDurationSeconds: number;
  getVoiceFileSignature: (file: File, durationSec: number) => string;
  setRecordedVoiceFile: (file: File | null) => void;
}

interface UseVoiceTranscriptOptions {
  currentJournalId: string | null;
  showMessage: (message: string, isError?: boolean) => void;
  onVoiceNoteUploaded?: (upload: {
    filePath: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  }) => void;
}

interface TranscriptPersistencePayload {
  voice_transcript_encrypted?: string | null;
  voice_transcript_iv?: string | null;
  voice_transcript_source_signature?: string | null;
  voice_transcript_generated_at?: string | null;
  [key: string]: unknown;
}

interface TranscriptApiResponse {
  transcript?: string;
}

export interface TranscriptCacheInput {
  voice_transcript_encrypted?: string | null;
  voice_transcript_iv?: string | null;
  voice_transcript_source_signature?: string | null;
  voice_transcript_generated_at?: string | null;
}

const TRANSCRIPT_RETRY_DELAYS_MS = [400, 1200];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

export function useVoiceTranscript({ currentJournalId, showMessage, onVoiceNoteUploaded }: UseVoiceTranscriptOptions) {
  const [isGeneratingTranscript, setIsGeneratingTranscript] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceTranscriptEncrypted, setVoiceTranscriptEncrypted] = useState<string | null>(null);
  const [voiceTranscriptIv, setVoiceTranscriptIv] = useState<string | null>(null);
  const [voiceTranscriptSignature, setVoiceTranscriptSignature] = useState<string | null>(null);
  const [voiceTranscriptGeneratedAt, setVoiceTranscriptGeneratedAt] = useState<string | null>(null);
  const [generatedTranscriptSignatures, setGeneratedTranscriptSignatures] = useState<string[]>([]);

  const handleRecordingSignature = (signature: string) => {
    setVoiceTranscriptSignature(signature);
  };

  const ensureTranscriptSourceFile = async (
    source: TranscriptSourceInput
  ): Promise<{ file: File; signature: string } | null> => {
    const {
      recordedVoiceFile,
      recordedVoiceUrl,
      voiceDurationSeconds,
      getVoiceFileSignature,
      setRecordedVoiceFile,
    } = source;

    if (recordedVoiceFile) {
      const duration = voiceDurationSeconds > 0 ? voiceDurationSeconds : 1;
      const signature = voiceTranscriptSignature || getVoiceFileSignature(recordedVoiceFile, duration);
      if (!voiceTranscriptSignature) {
        setVoiceTranscriptSignature(signature);
      }
      return { file: recordedVoiceFile, signature };
    }

    if (!recordedVoiceUrl) {
      return null;
    }

    try {
      const response = await fetch(recordedVoiceUrl);
      if (!response.ok) {
        throw new Error('Failed to load saved voice clip.');
      }

      const blob = await response.blob();
      if (!blob.size) {
        throw new Error('Saved voice clip is empty.');
      }

      const mime = blob.type || 'audio/webm';
      const extension = mime.includes('mpeg') ? 'mp3' : mime.split('/')[1] || 'webm';
      const file = new File([blob], `voice_note_existing.${extension}`, { type: mime });

      setRecordedVoiceFile(file);

      const duration = voiceDurationSeconds > 0 ? voiceDurationSeconds : 1;
      const signature = voiceTranscriptSignature || getVoiceFileSignature(file, duration);
      if (!voiceTranscriptSignature) {
        setVoiceTranscriptSignature(signature);
      }

      return { file, signature };
    } catch (error) {
      console.error('Failed to reconstruct transcript source file:', error);
      return null;
    }
  };

  const generateTranscript = async (source: TranscriptSourceInput) => {
    if (isGeneratingTranscript) {
      return;
    }

    const transcriptSource = await ensureTranscriptSourceFile(source);

    if (!transcriptSource) {
      showMessage('Record audio first to generate a transcript.', true);
      return;
    }

    const { file: sourceFile, signature: sourceSignature } = transcriptSource;

    if (generatedTranscriptSignatures.includes(sourceSignature)) {
      showMessage('Transcript for this voice note is already added. Record another note to append more.');
      return;
    }

    try {
      setIsGeneratingTranscript(true);

      const uploadResponse = await fetch('/api/audio-analysis/presigned-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: sourceFile.name,
          fileSize: sourceFile.size,
          mimeType: sourceFile.type || 'audio/webm',
        }),
      });

      if (!uploadResponse.ok) {
        const errorBody = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorBody?.error || 'Failed to get upload URL for voice note');
      }

      const uploadData = await uploadResponse.json() as {
        uploadUrl: string;
        filePath: string;
        path?: string;
        token?: string;
      };

      console.debug('[useVoiceTranscript] presigned upload response:', uploadData);

      const uploadTargetPath = uploadData.filePath || uploadData.path;
      if (!uploadTargetPath) {
        throw new Error('Voice note upload URL did not return a storage path');
      }

      const putResponse = await fetch(uploadData.uploadUrl, {
        method: 'PUT',
        body: sourceFile,
        headers: {
          'Content-Type': sourceFile.type || 'audio/webm',
        },
      });

      console.debug('[useVoiceTranscript] PUT upload response status:', putResponse.status);
      if (!putResponse.ok) {
        const text = await putResponse.text().catch(() => '');
        console.error('[useVoiceTranscript] PUT upload failed body:', text);
        throw new Error(`Failed to upload voice note (${putResponse.status})`);
      }

      const uploadedVoiceNote = {
        filePath: uploadTargetPath,
        fileName: sourceFile.name,
        mimeType: sourceFile.type || 'audio/webm',
        fileSize: sourceFile.size,
      };

      console.debug('[useVoiceTranscript] uploadedVoiceNote:', uploadedVoiceNote);
      if (typeof onVoiceNoteUploaded === 'function') {
        try {
          onVoiceNoteUploaded(uploadedVoiceNote);
          console.debug('[useVoiceTranscript] onVoiceNoteUploaded callback invoked');
        } catch (cbErr) {
          console.error('[useVoiceTranscript] onVoiceNoteUploaded callback threw:', cbErr);
        }
      }

      let result: TranscriptApiResponse | null = null;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= TRANSCRIPT_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          const response = await fetch('/api/voice-transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filePath: uploadedVoiceNote.filePath,
              fileName: uploadedVoiceNote.fileName,
              mimeType: uploadedVoiceNote.mimeType,
            }),
          });

          if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            const message = errorBody?.message || errorBody?.error || 'Failed to generate transcript';
            const error = new Error(message);

            if (!isRetryableStatus(response.status)) {
              throw error;
            }

            lastError = error;
            if (attempt < TRANSCRIPT_RETRY_DELAYS_MS.length) {
              const retryDelay = TRANSCRIPT_RETRY_DELAYS_MS[attempt];
              if (retryDelay !== undefined) {
                await sleep(retryDelay);
              }
              continue;
            }
            throw error;
          }

          result = await response.json();
          lastError = null;
          break;
        } catch (requestError: unknown) {
          const normalizedError = requestError instanceof Error
            ? requestError
            : new Error('Failed to generate transcript');

          lastError = normalizedError;
          const isLastAttempt = attempt >= TRANSCRIPT_RETRY_DELAYS_MS.length;

          if (isLastAttempt) {
            throw normalizedError;
          }

          const retryDelay = TRANSCRIPT_RETRY_DELAYS_MS[attempt];
          if (retryDelay !== undefined) {
            await sleep(retryDelay);
          }
        }
      }

      if (!result) {
        throw lastError || new Error('Failed to generate transcript');
      }

      const transcript = result?.transcript || '';

      if (!transcript.trim()) {
        throw new Error('Transcript is empty. Try a clearer recording.');
      }

      const mergedTranscript = voiceTranscript.trim()
        ? `${voiceTranscript.trim()}\n\n${transcript}`
        : transcript;

      setVoiceTranscript(mergedTranscript);
      setVoiceTranscriptSignature(sourceSignature);
      setGeneratedTranscriptSignatures((prev) => (
        prev.includes(sourceSignature) ? prev : [...prev, sourceSignature]
      ));
      const generatedAt = new Date().toISOString();
      setVoiceTranscriptGeneratedAt(generatedAt);

      // Keep journal content fully user-authored; do not auto-insert transcript.

      if (isEncryptionInitialized()) {
        const userResponse = await fetch('/api/user/current');
        const userData = await userResponse.json();
        const userId = userData?.user?.id;
        if (userId) {
          const key = await getEncryptionKey(userId);
          const encrypted = await encryptText(mergedTranscript, key);
          setVoiceTranscriptEncrypted(encrypted.ciphertext);
          setVoiceTranscriptIv(encrypted.iv);
        }
      }

      showMessage('Transcript generated and merged successfully.');
    } catch (error: unknown) {
      console.error('Transcript generation failed:', error);
      const message = error instanceof Error ? error.message : 'Transcript generation failed.';
      showMessage(message, true);
    } finally {
      setIsGeneratingTranscript(false);
    }
  };

  const ensureTranscriptEncryptionForUser = async (userId: string) => {
    if (voiceTranscriptEncrypted && voiceTranscriptIv) {
      return {
        encrypted: voiceTranscriptEncrypted,
        iv: voiceTranscriptIv,
      };
    }

    if (!voiceTranscript.trim()) {
      return null;
    }

    const key = await getEncryptionKey(userId);
    const encryptedTranscript = await encryptText(voiceTranscript, key);
    setVoiceTranscriptEncrypted(encryptedTranscript.ciphertext);
    setVoiceTranscriptIv(encryptedTranscript.iv);

    return {
      encrypted: encryptedTranscript.ciphertext,
      iv: encryptedTranscript.iv,
    };
  };

  const addTranscriptFieldsToPayload = async (payload: TranscriptPersistencePayload, userId?: string) => {
    payload.voice_transcript_source_signature = voiceTranscriptSignature;
    payload.voice_transcript_generated_at = voiceTranscriptGeneratedAt;

    if (voiceTranscriptEncrypted && voiceTranscriptIv) {
      payload.voice_transcript_encrypted = voiceTranscriptEncrypted;
      payload.voice_transcript_iv = voiceTranscriptIv;
      return;
    }

    if (!userId || !voiceTranscript.trim()) {
      payload.voice_transcript_encrypted = payload.voice_transcript_encrypted || null;
      payload.voice_transcript_iv = payload.voice_transcript_iv || null;
      return;
    }

    const encryptedTranscript = await ensureTranscriptEncryptionForUser(userId);
    payload.voice_transcript_encrypted = encryptedTranscript?.encrypted || null;
    payload.voice_transcript_iv = encryptedTranscript?.iv || null;
  };

  const resetTranscriptState = () => {
    setIsGeneratingTranscript(false);
    setVoiceTranscript('');
    setVoiceTranscriptEncrypted(null);
    setVoiceTranscriptIv(null);
    setVoiceTranscriptSignature(null);
    setVoiceTranscriptGeneratedAt(null);
    setGeneratedTranscriptSignatures([]);
  };

  const updateVoiceTranscript = (nextTranscript: string) => {
    setVoiceTranscript(nextTranscript);
    // Force fresh encryption on next save payload so edited transcript persists correctly.
    setVoiceTranscriptEncrypted(null);
    setVoiceTranscriptIv(null);
  };

  const hydrateTranscriptFromCache = async (cachedTranscript: TranscriptCacheInput | null | undefined) => {
    if (!cachedTranscript) {
      return;
    }

    const encryptedTranscript = cachedTranscript.voice_transcript_encrypted || null;
    const transcriptIv = cachedTranscript.voice_transcript_iv || null;
    const sourceSignature = cachedTranscript.voice_transcript_source_signature || null;
    const generatedAt = cachedTranscript.voice_transcript_generated_at || null;

    setVoiceTranscriptEncrypted(encryptedTranscript);
    setVoiceTranscriptIv(transcriptIv);
    setVoiceTranscriptSignature(sourceSignature);
    setVoiceTranscriptGeneratedAt(generatedAt);

    if (sourceSignature) {
      setGeneratedTranscriptSignatures((prev) => (
        prev.includes(sourceSignature) ? prev : [...prev, sourceSignature]
      ));
    }

    if (!encryptedTranscript || !transcriptIv || !isEncryptionInitialized()) {
      return;
    }

    try {
      const userResp = await fetch('/api/user/current');
      const userJson = await userResp.json();
      const userId = userJson?.user?.id;

      if (!userId) {
        return;
      }

      const key = await getEncryptionKey(userId);
      const decryptedTranscript = await decryptText(encryptedTranscript, transcriptIv, key);
      setVoiceTranscript(decryptedTranscript || '');
    } catch (error) {
      console.warn('[JournalEntry] Failed to hydrate cached voice transcript:', error);
    }
  };

  useEffect(() => {
    const restoreVoiceTranscript = async () => {
      if (!currentJournalId || currentJournalId.startsWith('temp_')) {
        return;
      }

      // Avoid noisy 404s for client-generated IDs that have not synced yet.
      try {
        const legacyKey = `journal_entry_${currentJournalId}`;
        let localEntryRaw = localStorage.getItem(legacyKey);

        if (!localEntryRaw) {
          for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('journal_entry_v2_')) {
              continue;
            }

            if (key.endsWith(`_${currentJournalId}`)) {
              localEntryRaw = localStorage.getItem(key);
              if (localEntryRaw) {
                break;
              }
            }
          }
        }

        if (localEntryRaw) {
          const localEntry = JSON.parse(localEntryRaw) as { _synced?: boolean };
          if (!localEntry?._synced) {
            return;
          }
        }
      } catch {
        // Non-fatal; continue with remote restore when local state is unavailable.
      }

      try {
        const response = await fetch(`/api/journals/${currentJournalId}`);
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        const journal = payload?.journal;
        if (!journal) {
          return;
        }

        const encryptedTranscript = journal.voice_transcript_encrypted as string | null;
        const transcriptIv = journal.voice_transcript_iv as string | null;
        const sourceSignature = journal.voice_transcript_source_signature as string | null;
        const generatedAt = journal.voice_transcript_generated_at as string | null;

        setVoiceTranscriptEncrypted(encryptedTranscript || null);
        setVoiceTranscriptIv(transcriptIv || null);
        setVoiceTranscriptSignature(sourceSignature || null);
        setVoiceTranscriptGeneratedAt(generatedAt || null);
        if (sourceSignature) {
          setGeneratedTranscriptSignatures([sourceSignature]);
        }

        if (encryptedTranscript && transcriptIv && isEncryptionInitialized()) {
          const userResp = await fetch('/api/user/current');
          const userJson = await userResp.json();
          const userId = userJson?.user?.id;

          if (userId) {
            const key = await getEncryptionKey(userId);
            const decryptedTranscript = await decryptText(encryptedTranscript, transcriptIv, key);
            setVoiceTranscript(decryptedTranscript || '');
          }
        }
      } catch (error) {
        console.warn('[JournalEntry] Failed to restore voice transcript:', error);
      }
    };

    void restoreVoiceTranscript();
  }, [currentJournalId]);

  return {
    isGeneratingTranscript,
    voiceTranscript,
    voiceTranscriptEncrypted,
    voiceTranscriptIv,
    voiceTranscriptSignature,
    voiceTranscriptGeneratedAt,
    handleRecordingSignature,
    generateTranscript,
    addTranscriptFieldsToPayload,
    ensureTranscriptEncryptionForUser,
    updateVoiceTranscript,
    hydrateTranscriptFromCache,
    resetTranscriptState,
  };
}
