'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AnimatedOrb from './animated-orb';
import { isEncryptionInitialized, getEncryptionKey, restoreEncryptionFromCache } from '@/utils/encryption/keyManager';
import { ensureEncryptionReady } from '@/utils/encryption';
import { decryptText, encryptText } from '@/utils/encryption/crypto';
import { X } from 'lucide-react';
import { useVoiceRecording } from '@/components/Journal/JournalEntry/useVoiceRecording';
import VoiceActivityDots from '@/components/VoiceActivityDots';
import { useVoiceTranscript } from '@/components/Journal/JournalEntry/useVoiceTranscript';
import { toast } from '@/hooks/use-toast';

interface EntryStepProps {
  mode: 'write' | 'speak' | null;
  onComplete: (result?: { journalId: string; mode: 'write' | 'speak' }) => void;
  isReadOnly?: boolean;
  previewJournalId?: string | null;
  previewMetadata?: {
    recognitionResult: string | null;
    reflectionPrompt: string | null;
    onboardingContext: string | null;
  } | null;
  onExit?: () => void;
}

export default function EntryStep({
  mode,
  onComplete,
  isReadOnly = false,
  previewJournalId = null,
  previewMetadata = null,
  onExit,
}: EntryStepProps) {
  const [entry, setEntry] = useState('');
  const [isSavingVoice, setIsSavingVoice] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const saveInFlightRef = useRef(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewTranscript, setPreviewTranscript] = useState('');
  const voiceNoteUploadInfoRef = useRef<{
    filePath: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  } | null>(null);

  const showMessage = useCallback((message: string, isError?: boolean) => {
    toast({
      title: isError ? 'Error' : 'Success',
      description: message,
      variant: isError ? 'destructive' : 'default',
    });
  }, []);


  const ensureEncryptionReadyForSession = useCallback(async (userId: string, isOAuthUser: boolean) => {
    if (isEncryptionInitialized()) {
      return { ready: true as const };
    }

    const restored = await restoreEncryptionFromCache(userId);
    if (restored || isEncryptionInitialized()) {
      return { ready: true as const };
    }

    const status = await ensureEncryptionReady({ userId, isOAuthUser });
    if (status.ready) {
      return { ready: true as const };
    }
    
    if (status.status === 'legacy_otp_required') {
        return {
            ready: false as const,
            message: 'A security upgrade is required for your account. Please complete verification.',
            status: 'legacy_otp_required'
        };
    }

    if (status.status === 'new_device') {
      return {
        ready: false as const,
        message: 'This device needs to be verified before accessing your encrypted journals.',
        status: 'new_device',
      };
    }

    if (!isOAuthUser) {
      return {
        ready: false as const,
        message: 'Encryption is locked for this session. Please sign out and sign back in to continue.',
      };
    }

    return {
      ready: false as const,
      message: 'Encryption is not initialized for your session. Please sign out and sign back in.',
    };
  }, []);

  const resolveSavedOnboardingJournalId = useCallback(async (response: Response): Promise<string | null> => {
    const body = await response.json().catch(() => ({}));
    console.debug('[EntryStep] Journal API response:', { status: response.status, body });
    
    if (response.ok) {
      const journalId = body?.journal?.journal_id || body?.journal?.id || body?.id || body?.journal_id || null;
      if (!journalId) {
        console.error('[EntryStep] Response was OK but no journal ID in body:', body);
      }
      return journalId;
    }

    if (response.status === 409) {
      try {
        const resultResponse = await fetch('/api/user/onboarding-result');
        if (resultResponse.ok) {
          const resultJson = await resultResponse.json().catch(() => ({}));
          return resultJson?.result?.journal_id || null;
        }
      } catch (error) {
        console.error('[EntryStep] Failed to resolve existing onboarding journal id:', error);
      }
      return null;
    }

    console.error('[EntryStep] Save failed with status', response.status, ':', body);
    throw new Error(body?.error || `Failed to save entry (${response.status})`);
  }, []);
  const [voiceNoteUploadInfo, setVoiceNoteUploadInfo] = useState<{
    filePath: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  } | null>(null);

  const {
    handleRecordingSignature,
    generateTranscript,
    addTranscriptFieldsToPayload,
    resetTranscriptState,
    voiceTranscript,
    isGeneratingTranscript,
  } = useVoiceTranscript({
    currentJournalId: null,
    showMessage,
    onVoiceNoteUploaded: (upload) => {
      voiceNoteUploadInfoRef.current = upload as any;
      setVoiceNoteUploadInfo(upload as any);
    },
  });

  
  // include media stream for live VU meter
  // `useVoiceRecording` returns `voiceStream` in addition to other controls
  const {
    voiceRecordingState,
    recordedVoiceFile,
    recordedVoiceUrl,
    voiceDurationSeconds,
    getVoiceFileSignature,
    setRecordedVoiceFile,
    newlyRecordedFile,
    startVoiceRecording,
    stopVoiceRecording,
    resetVoiceRecording,
    clearNewlyRecordedFile,
    voiceStream,
  } = useVoiceRecording({
    onRecordingSignature: handleRecordingSignature,
    onError: (message) => showMessage(message, true),
  });

  // LLM-generated question saved during mode selection step
  const [llmQuestion, setLlmQuestion] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = localStorage.getItem('force_mode_selection_question');
      if (cached && cached.trim()) setLlmQuestion(cached.trim());
    } catch (err) {
      console.debug('Failed to read LLM question from localStorage:', err);
    }
  }, []);


  const handleSave = () => {
    void (async () => {
      if (!entry.trim() || isSavingEntry || saveInFlightRef.current) return;

      saveInFlightRef.current = true;
      setIsSavingEntry(true);

      try {
        // Get current user id to derive encryption key
        const userResp = await fetch('/api/user/current');
        if (!userResp.ok) {
          throw new Error('Failed to fetch user information');
        }
        const userJson = await userResp.json();
        const userId = userJson?.user?.id;
        if (!userId) {
          throw new Error('User not found');
        }

        const isOAuthUser = userJson?.user?.app_metadata?.provider !== 'email';

        const encryptionStatus = await ensureEncryptionReadyForSession(userId, isOAuthUser);

        if (!encryptionStatus.ready) {
          toast({
            title: 'Encryption Required',
            description: encryptionStatus.message,
            variant: 'destructive',
          });

          if ('unlockUrl' in encryptionStatus && typeof window !== 'undefined') {
            window.location.assign((encryptionStatus as any).unlockUrl);
          }

          return;
        }

        const key = await getEncryptionKey(userId);
        const journalId = crypto.randomUUID();

        // Use a fixed aesthetic title for onboarding first entries
        const ONBOARDING_FIRST_ENTRY_TITLE = 'First Reflections';
        const titlePlain = ONBOARDING_FIRST_ENTRY_TITLE;

        const encryptedTitle = titlePlain ? await encryptText(titlePlain, key) : null;
        const encryptedContent = await encryptText(entry, key);

        const wordCount = entry.trim() ? entry.trim().split(/\s+/).length : 0;

        const payload: Record<string, unknown> = {
          journal_id: journalId,
          journal_type: 'personal',
          is_encrypted: true,
          title_encrypted: encryptedTitle ? encryptedTitle.ciphertext : null,
          title_iv: encryptedTitle ? encryptedTitle.iv : null,
          content_encrypted: encryptedContent.ciphertext,
          content_iv: encryptedContent.iv,
          word_count: wordCount,
          tags: ['1st entry', 'onboarding entry'],
          save_source: 'onboarding',
        };

        const resp = await fetch('/api/journals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const savedJournalId = await resolveSavedOnboardingJournalId(resp);

        if (!savedJournalId) {
          if (resp.status === 409) {
            toast({
              title: 'Entry already saved',
              description: 'Your onboarding entry is already saved. You can preview it now.',
            });
            throw new Error('Unable to resolve saved onboarding entry id. Please refresh and try again.');
          }

          throw new Error('Failed to save entry');
        }

        // Success — complete onboarding
        onComplete({ journalId: savedJournalId, mode: 'write' });
      } catch (err: unknown) {
        console.error('Onboarding save failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to save entry.';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      } finally {
        saveInFlightRef.current = false;
        setIsSavingEntry(false);
      }
    })();
  };

  const handleExit = () => {
    if (isReadOnly && onExit) {
      onExit();
      return;
    }
    onComplete();
  };

  useEffect(() => {
    if (!isReadOnly || !previewJournalId) {
      return;
    }

    let isActive = true;

    const loadPreview = async () => {
      setIsPreviewLoading(true);
      setPreviewError(null);

      try {
        const userResp = await fetch('/api/user/current');
        if (!userResp.ok) {
          throw new Error('Failed to fetch user information');
        }
        const userJson = await userResp.json();
        const userId = userJson?.user?.id;
        if (!userId) {
          throw new Error('User not found');
        }

        const isOAuthUser = userJson?.user?.app_metadata?.provider !== 'email';

        const encryptionStatus = await ensureEncryptionReadyForSession(userId, isOAuthUser);

        if (!encryptionStatus.ready) {
          if ('unlockUrl' in encryptionStatus && typeof window !== 'undefined') {
            window.location.assign((encryptionStatus as any).unlockUrl);
          }
          throw new Error(encryptionStatus.message);
        }

        const key = await getEncryptionKey(userId);

        const journalResp = await fetch(`/api/journals/${previewJournalId}`);
        if (!journalResp.ok) {
          const body = await journalResp.json().catch(() => ({}));
          throw new Error(body?.error || 'Failed to load onboarding entry');
        }

        const journalData = await journalResp.json();
        const journal = journalData?.journal;

        if (!journal) {
          throw new Error('Onboarding entry not found');
        }

        if (journal.content_encrypted && journal.content_iv) {
          const decryptedContent = await decryptText(
            journal.content_encrypted,
            journal.content_iv,
            key
          );
          if (isActive) {
            setEntry(decryptedContent || '');
          }
        }

        if (journal.voice_transcript_encrypted && journal.voice_transcript_iv) {
          const decryptedTranscript = await decryptText(
            journal.voice_transcript_encrypted,
            journal.voice_transcript_iv,
            key
          );
          if (isActive) {
            setPreviewTranscript(decryptedTranscript || '');
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load preview.';
        if (isActive) {
          setPreviewError(message);
        }
      } finally {
        if (isActive) {
          setIsPreviewLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      isActive = false;
    };
  }, [isReadOnly, previewJournalId, ensureEncryptionReadyForSession]);

  useEffect(() => {
    if (!newlyRecordedFile) {
      return;
    }

    const preparePreview = async () => {
      setVoiceError(null);
      await generateTranscript({
        recordedVoiceFile: recordedVoiceFile || newlyRecordedFile,
        recordedVoiceUrl,
        voiceDurationSeconds,
        getVoiceFileSignature,
        setRecordedVoiceFile,
      });
    };

    void preparePreview();
  }, [
    newlyRecordedFile,
    recordedVoiceFile,
    recordedVoiceUrl,
    voiceDurationSeconds,
    getVoiceFileSignature,
    setRecordedVoiceFile,
    generateTranscript,
  ]);

  const handleSaveVoiceEntry = () => {
    void (async () => {
      if (isReadOnly || isSavingVoice || saveInFlightRef.current) return;

      if (!recordedVoiceUrl && !recordedVoiceFile) {
        setVoiceError('Record audio before saving.');
        return;
      }

      if (!voiceTranscript.trim()) {
        setVoiceError('Generate a transcript before saving.');
        return;
      }

      const uploadInfo = voiceNoteUploadInfoRef.current;
      if (!uploadInfo) {
        setVoiceError('Audio upload is not ready yet. Please wait for the transcript to finish.');
        return;
      }

      saveInFlightRef.current = true;
      setIsSavingVoice(true);
      setVoiceError(null);

      try {
        const userResp = await fetch('/api/user/current');
        if (!userResp.ok) {
          throw new Error('Failed to fetch user information');
        }
        const userJson = await userResp.json();
        const userId = userJson?.user?.id;
        if (!userId) {
          throw new Error('User not found');
        }

        const isOAuthUser = userJson?.user?.app_metadata?.provider !== 'email';

        const encryptionStatus = await ensureEncryptionReadyForSession(userId, isOAuthUser);

        if (!encryptionStatus.ready) {
          if ('unlockUrl' in encryptionStatus && typeof window !== 'undefined') {
            window.location.assign((encryptionStatus as any).unlockUrl);
          }
          throw new Error(encryptionStatus.message);
        }

        const key = await getEncryptionKey(userId);
        // Use the same fixed aesthetic title for onboarding voice entries
        const ONBOARDING_FIRST_ENTRY_TITLE = 'First Reflections';
        const titlePlain = ONBOARDING_FIRST_ENTRY_TITLE;
        const encryptedTitle = await encryptText(titlePlain, key);
        const encryptedContent = await encryptText('', key);
        const journalId = crypto.randomUUID();

        const payload: Record<string, unknown> = {
          journal_id: journalId,
          journal_type: 'personal',
          is_encrypted: true,
          title_encrypted: encryptedTitle.ciphertext,
          title_iv: encryptedTitle.iv,
          content_encrypted: encryptedContent.ciphertext,
          content_iv: encryptedContent.iv,
          word_count: 0,
          tags: ['1st entry', 'onboarding entry'],
          save_source: 'onboarding',
          is_default_voice_title: true,
        };

        await addTranscriptFieldsToPayload(payload, userId);

        console.debug('[EntryStep] Saving voice entry with payload:', payload);

        const resp = await fetch('/api/journals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        console.debug('[EntryStep] Journal save response status:', resp.status);

        let savedJournalId: string | null = null;

        if (resp.status === 409) {
          const conflictBody = await resp.json().catch(() => ({}));
          const existingJournalId = conflictBody?.journal_id || conflictBody?.journal?.journal_id || conflictBody?.journal?.id || null;

          if (!existingJournalId) {
            throw new Error('Onboarding entry already exists, but no journal ID was returned.');
          }

          const updatePayload = {
            ...payload,
            journal_id: existingJournalId,
          };

          console.debug('[EntryStep] Updating onboarding journal after conflict:', existingJournalId);

          const updateResp = await fetch('/api/journals', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload),
          });

          console.debug('[EntryStep] Journal update response status:', updateResp.status);
          savedJournalId = await resolveSavedOnboardingJournalId(updateResp);
        } else {
          savedJournalId = await resolveSavedOnboardingJournalId(resp);
        }

        if (!savedJournalId) {
          throw new Error('Failed to save voice entry: No journal ID returned from server');
        }

        try {
          console.debug('[EntryStep] Attaching voice file to journal:', savedJournalId, uploadInfo);
          const attachResp = await fetch('/api/journals/media/from-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              journal_id: savedJournalId,
              filePath: uploadInfo.filePath,
              fileName: uploadInfo.fileName,
              fileSize: uploadInfo.fileSize,
              mimeType: uploadInfo.mimeType,
            }),
          });
          if (!attachResp.ok) {
            const errorBody = await attachResp.json().catch(() => ({}));
            console.error('[EntryStep] Failed to attach voice file:', attachResp.status, errorBody);
          } else {
            console.debug('[EntryStep] Voice file attached successfully');
          }
        } catch (attachErr) {
          console.error('Failed to attach uploaded voice file to journal:', attachErr);
        } finally {
          voiceNoteUploadInfoRef.current = null;
          setVoiceNoteUploadInfo(null);
        }

        resetVoiceRecording();
        resetTranscriptState();
        onComplete({ journalId: savedJournalId, mode: 'speak' });
      } catch (err: unknown) {
        console.error('Onboarding voice save failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to save voice entry.';
        setVoiceError(message);
        showMessage(message, true);
      } finally {
        saveInFlightRef.current = false;
        clearNewlyRecordedFile();
        setIsSavingVoice(false);
      }
    })();
  };

  const handleGenerateTranscript = () => {
    if (isReadOnly || isGeneratingTranscript) return;
    void generateTranscript({
      recordedVoiceFile: recordedVoiceFile || newlyRecordedFile,
      recordedVoiceUrl,
      voiceDurationSeconds,
      getVoiceFileSignature,
      setRecordedVoiceFile,
    });
  };

  const handleRerecord = () => {
    if (isReadOnly || isSavingVoice) return;
    resetVoiceRecording();
    resetTranscriptState();
    setVoiceError(null);
    voiceNoteUploadInfoRef.current = null;
    setVoiceNoteUploadInfo(null);
    clearNewlyRecordedFile();
  };

  const handleStartStop = () => {
    if (isReadOnly) {
      return;
    }
    if (voiceRecordingState === 'recording') {
      stopVoiceRecording();
      return;
    }

    setVoiceError(null);
    resetTranscriptState();
    voiceNoteUploadInfoRef.current = null;
    setVoiceNoteUploadInfo(null);
    startVoiceRecording();
  };

  const startEnabled = !(isReadOnly || isSavingVoice || isGeneratingTranscript);

  const showPreviewMeta = Boolean(
    previewMetadata?.recognitionResult ||
    previewMetadata?.reflectionPrompt ||
    previewMetadata?.onboardingContext
  );


  if (mode === 'speak') {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center px-6 py-16 pb-20 md:py-20">
        {/* Close button */}
        <button
          onClick={handleExit}
          className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/60 hover:bg-white flex items-center justify-center transition-all"
        >
          <X size={24} className="text-foreground" />
        </button>

        {/* Animated orb */}
        <div className="mb-16">
          <AnimatedOrb />
        </div>

        {/* Title */}
        <h2 className="font-terminal-grotesque text-5xl md:text-6xl text-foreground text-center mb-4 leading-relaxed font-medium tracking-[-0.02em]">
          Say anything. I&apos;m listening.
        </h2>

        {/* Subtitle (use LLM-generated question if available) */}
        <p className="font-terminal-grotesque text-xl md:text-2xl text-foreground/60 text-center mb-12 font-medium tracking-[0.01em]">
          {llmQuestion || `Take your time. There's no rush.`}
        </p>

        {isReadOnly && showPreviewMeta && (
          <div className="w-full max-w-2xl rounded-3xl border border-white/60 bg-white/70 p-6 shadow-[0_24px_80px_rgba(120,93,70,0.12)] backdrop-blur-xl mb-10">
            <p className="font-terminal-grotesque text-[11px] uppercase tracking-[0.16em] text-foreground/45">
              Onboarding context
            </p>
            <div className="mt-4 space-y-3 text-base text-foreground/75">
              {previewMetadata?.recognitionResult && (
                <p>
                  <span className="text-foreground/45">Recognition:</span> {previewMetadata.recognitionResult}
                </p>
              )}
              {previewMetadata?.reflectionPrompt && (
                <p>
                  <span className="text-foreground/45">Reflection prompt:</span> {previewMetadata.reflectionPrompt}
                </p>
              )}
              {previewMetadata?.onboardingContext && (
                <p className="whitespace-pre-wrap">
                  <span className="text-foreground/45">Context:</span> {previewMetadata.onboardingContext}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Audio visualization (live when recording) */}
        <div className="flex gap-2 items-center justify-center mb-16">
          {voiceStream && voiceRecordingState === 'recording' ? (
            <VoiceActivityDots stream={voiceStream} bars={24} />
          ) : (
            <div className="flex gap-2 items-center justify-center">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 audio-bar bg-linear-to-t from-primary to-pink-300 rounded-full"
                  style={{
                    height: '8px',
                    animationDelay: `${i * 0.08}s`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recording indicator */}
        <button
          onClick={handleStartStop}
          disabled={isReadOnly || isSavingVoice || isGeneratingTranscript}
          className={`px-8 py-4 rounded-full text-lg font-medium transition-all animate-in fade-in disabled:opacity-70 ${
            startEnabled ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isReadOnly
            ? 'Recording locked'
            : voiceRecordingState === 'recording'
              ? 'Stop recording'
              : 'Start recording'}
        </button>

        {voiceError && (
          <div className="mt-6 w-full max-w-xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
            {voiceError}
          </div>
        )}

        {((recordedVoiceUrl || voiceRecordingState === 'recorded') || (isReadOnly && previewJournalId)) && (
          <div className="mt-12 w-full max-w-2xl rounded-3xl border border-white/60 bg-white/70 p-6 shadow-[0_24px_80px_rgba(120,93,70,0.12)] backdrop-blur-xl animate-in fade-in duration-500">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-terminal-grotesque text-[11px] uppercase tracking-[0.16em] text-foreground/45">
                  Voice note preview
                </p>
                <h3 className="mt-1 font-terminal-grotesque text-3xl font-medium text-foreground tracking-[-0.01em]">
                  Your recording
                </h3>
              </div>

              {(isSavingVoice || isGeneratingTranscript) && (
                <span className="font-terminal-grotesque rounded-full bg-foreground/5 px-3 py-1 text-xs uppercase tracking-[0.14em] text-foreground/60">
                  {isGeneratingTranscript ? 'Preparing transcript' : 'Saving'}
                </span>
              )}
            </div>

            {recordedVoiceUrl ? (
              <audio
                controls
                src={recordedVoiceUrl}
                className="mt-5 w-full"
              />
            ) : (
              <p className="mt-5 text-base text-foreground/55">
                {isReadOnly ? 'Audio preview is available in your journal.' : 'Processing your voice note...'}
              </p>
            )}

            <div className="mt-5 rounded-2xl bg-foreground/5 p-4">
              <p className="font-terminal-grotesque text-[11px] uppercase tracking-[0.16em] text-foreground/45">
                Transcript preview
              </p>

              {isGeneratingTranscript && !isReadOnly ? (
                <p className="mt-3 font-terminal-grotesque text-base leading-relaxed text-foreground/60">
                  Generating transcript from your recording...
                </p>
              ) : (
                <p className="mt-3 font-terminal-grotesque whitespace-pre-wrap text-base leading-relaxed text-foreground/75">
                  {(isReadOnly ? previewTranscript : voiceTranscript).trim() || 'Your transcript will appear here after processing.'}
                </p>
              )}
            </div>

            <p className="mt-4 font-terminal-grotesque text-sm text-foreground/45">
              This preview appears before the note is saved to your journal.
            </p>
          </div>
        )}

        {!isReadOnly && (recordedVoiceUrl || voiceRecordingState === 'recorded') && (
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3 pb-2">
            {!voiceTranscript.trim() && !isGeneratingTranscript && (
              <button
                onClick={handleGenerateTranscript}
                className="font-terminal-grotesque rounded-full border border-foreground/20 px-5 py-2 text-base text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground"
              >
                Generate transcript
              </button>
            )}
            <button
              onClick={handleRerecord}
              disabled={isSavingVoice || isGeneratingTranscript}
              className="font-terminal-grotesque rounded-full border border-foreground/20 bg-white/65 px-5 py-2 text-base text-foreground/75 transition-all hover:border-foreground/40 hover:bg-white hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Re-record
            </button>
            <button
              onClick={handleSaveVoiceEntry}
              disabled={isSavingVoice || isGeneratingTranscript || !voiceTranscript.trim() || !voiceNoteUploadInfo}
              className="font-terminal-grotesque rounded-full bg-[#8b6a55] px-6 py-2 text-sm font-medium text-white shadow-lg shadow-[#8b6a55]/15 transition-all hover:bg-[#7a5d4a] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingVoice ? 'Saving...' : 'Save voice entry'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Write mode (default)
  return (
    <div className="w-full min-h-screen flex flex-col">
      {/* Close button */}
      <button
        onClick={handleExit}
        className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/60 hover:bg-white flex items-center justify-center transition-all font-terminal-grotesque"
      >
        <X size={24} className="text-foreground" />
      </button>

      {/* Animated orb at top */}
      <div className="pt-8 px-6 flex justify-center">
        <AnimatedOrb />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          {isReadOnly && showPreviewMeta && (
            <div className="mb-6 rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl backdrop-blur-sm">
              <p className="font-terminal-grotesque text-[11px] uppercase tracking-[0.16em] text-foreground/45">
                Onboarding context
              </p>
              <div className="mt-4 space-y-3 text-sm text-foreground/75">
                {previewMetadata?.recognitionResult && (
                  <p className="font-terminal-grotesque">
                    <span className="text-foreground/45">Recognition:</span> {previewMetadata.recognitionResult}
                  </p>
                )}
                {previewMetadata?.reflectionPrompt && (
                  <p className="font-terminal-grotesque">
                    <span className="text-foreground/45">Reflection prompt:</span> {previewMetadata.reflectionPrompt}
                  </p>
                )}
                {previewMetadata?.onboardingContext && (
                  <p className="font-terminal-grotesque whitespace-pre-wrap">
                    <span className="text-foreground/45">Context:</span> {previewMetadata.onboardingContext}
                  </p>
                )}
              </div>
            </div>
          )}
          {/* Mac-style window */}
          <div className="bg-white/95 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-700">
            {/* Title bar with traffic lights */}
            <div className="bg-gray-100 px-6 py-4 flex items-center gap-3 border-b border-gray-200">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <div className="w-3 h-3 rounded-full bg-gray-400" />
              </div>
              <div className="flex flex-col">
                {llmQuestion ? (
                  <span className="text-base text-foreground/80 font-medium">{llmQuestion}</span>
                ) : null}
                <span className="text-sm text-foreground/60 font-medium">Write freely. No one else will see this.</span>
              </div>
            </div>

            {/* Content area */}
            <div className="p-8">
              <textarea
                value={entry}
                onChange={(e) => {
                  if (!isReadOnly) {
                    setEntry(e.target.value);
                  }
                }}
                placeholder="Begin anywhere..."
                readOnly={isReadOnly}
                className="w-full min-h-64 bg-transparent text-foreground text-xl md:text-2xl leading-relaxed placeholder:text-foreground/30 focus:outline-none resize-none font-medium"
              />
              {isReadOnly && (isPreviewLoading || previewError) && (
                <div className="mt-4 rounded-xl border border-foreground/10 bg-white/80 px-4 py-3 text-base text-foreground/70">
                  {isPreviewLoading
                    ? 'Loading your saved entry...'
                    : previewError || 'Preview not available.'}
                </div>
              )}
            </div>
          </div>

          {/* Save button */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleSave}
              disabled={isReadOnly || isSavingEntry || !entry.trim()}
              className={`px-8 py-3 rounded-full text-lg font-medium transition-all ${
                entry.trim() && !isReadOnly && !isSavingEntry
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isReadOnly ? 'Entry saved' : isSavingEntry ? 'Saving...' : 'Save entry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
