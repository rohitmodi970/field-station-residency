import { NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { BUCKETS } from '@/utils/supabase/storage';
import { processBufferWithDeepgram } from '@/utilities/DeepgramAudioProcess';
import { audioAnalysisService } from '@/services/analysis/audioAnalysisService';
import { isImentivConfigured } from '@/config/imentiv.config';
import { processBufferWithHume } from '@/utilities/HumeAudioProcess';
import type { NormalizedAudioAnalysisResult } from '@/types/audioAnalysis.contract';

export async function POST(request: Request) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user } = authResult;

    const contentType = request.headers.get('content-type') || '';
    let audioFileName = 'voice.webm';
    let audioBuffer: Buffer | null = null;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      const filePath = body?.filePath;
      audioFileName = body?.fileName || audioFileName;

      if (!filePath || typeof filePath !== 'string') {
        return NextResponse.json({ error: 'filePath is required' }, { status: 400 });
      }

      if (!filePath.startsWith(`${user.id}/`)) {
        return NextResponse.json({ error: 'Unauthorized access to file' }, { status: 403 });
      }

      const adminClient = createAdminClient();
      const { data: signedUrlData, error: signedUrlError } = await adminClient.storage
        .from(BUCKETS.USERS_CLOUD)
        .createSignedUrl(filePath, 600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        return NextResponse.json({ error: 'Failed to access uploaded voice note' }, { status: 500 });
      }

      const fileResponse = await fetch(signedUrlData.signedUrl);
      if (!fileResponse.ok) {
        return NextResponse.json({ error: 'Failed to download uploaded voice note' }, { status: 500 });
      }

      const arrayBuffer = await fileResponse.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
      if (!audioBuffer.length) {
        return NextResponse.json({ error: 'Audio file is empty' }, { status: 400 });
      }
    } else {
      const formData = await request.formData();
      const audioFile = formData.get('audioFile');

      if (!(audioFile instanceof File)) {
        return NextResponse.json({ error: 'audioFile is required' }, { status: 400 });
      }

      audioFileName = audioFile.name || audioFileName;
      const arrayBuffer = await audioFile.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
      if (!audioBuffer.length) {
        return NextResponse.json({ error: 'Audio file is empty' }, { status: 400 });
      }
    }

    let imentivJobId: string | null = null;
    const fileMime = contentType.includes('application/json') ? 'audio/webm' : 'audio/webm';

    // 1. Primary server engine: Deepgram Transcription (~300ms, streaming/buffer STT)
    if (process.env.DEEPGRAM_API_KEY) {
      try {
        console.log(`[voice-transcript] Processing audio with Deepgram for user ${user.id} (${audioFileName})...`);
        const deepgramResult = await processBufferWithDeepgram(audioBuffer, fileMime);
        const transcriptText = (deepgramResult.transcript || '').trim();

        if (transcriptText) {
          console.log(`[voice-transcript] Deepgram transcribed successfully: "${transcriptText.slice(0, 60)}..."`);
          return NextResponse.json({
            transcript: transcriptText,
            confidence: deepgramResult.confidence || 0.95,
            sentiment: deepgramResult.sentiment,
            summary: deepgramResult.summary || '',
            topics: deepgramResult.topics || [],
            keywords: deepgramResult.keywords || [],
            transcriptDetected: true,
            provider: 'deepgram',
            jobId: null,
          });
        }
      } catch (dgErr) {
        console.warn('[voice-transcript] Deepgram processing failed, falling back to secondary processor:', dgErr);
      }
    }

    // 2. Secondary fallback: OpenAI Whisper (fast, reliable STT)
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('[voice-transcript] Trying OpenAI Whisper fallback...');
        const whisperForm = new FormData();
        const uint8 = new Uint8Array(audioBuffer);
        const audioBlob = new Blob([uint8], { type: fileMime });
        whisperForm.append('file', audioBlob, audioFileName || 'audio.webm');
        whisperForm.append('model', 'whisper-1');
        whisperForm.append('language', 'en');

        const oaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: whisperForm,
        });

        if (oaiResponse.ok) {
          const oaiData = await oaiResponse.json();
          const transcriptText = String(oaiData?.text || '').trim();
          if (transcriptText) {
            console.log(`[voice-transcript] OpenAI Whisper transcribed successfully: "${transcriptText.slice(0, 60)}..."`);
            return NextResponse.json({
              transcript: transcriptText,
              confidence: 0.98,
              transcriptDetected: true,
              provider: 'openai-whisper',
              jobId: null,
            });
          }
        }
      } catch (whisperErr) {
        console.warn('[voice-transcript] OpenAI Whisper failed:', whisperErr);
      }
    }

    // 3. Tertiary fallback: Hume
    try {
      const hume = await processBufferWithHume(audioBuffer, user.id, audioFileName, false);
      const humeTranscript = (hume.transcript || '').trim();

      if (!hume.error && humeTranscript) {
        console.log(`[voice-transcript] Hume transcribed successfully: "${humeTranscript.slice(0, 60)}..."`);
        return NextResponse.json({
          transcript: humeTranscript,
          confidence: hume.confidence || 0.9,
          sentiment: hume.sentiment,
          summary: hume.summary || '',
          topics: hume.topics || [],
          keywords: hume.keywords || [],
          transcriptDetected: true,
          provider: 'hume',
          jobId: null,
        });
      }
    } catch (humeErr) {
      console.warn('[voice-transcript] Hume processing warning:', humeErr);
    }

    // 4. Quaternary fallback: Imentiv (short 5s polling wait so it never hangs requests)
    if (isImentivConfigured()) {
      try {
        console.log(`[voice-transcript] Falling back to Imentiv for user ${user.id} (${audioFileName})...`);
        const job = await audioAnalysisService.submitAudioJob(
          {
            userId: user.id,
            fileBuffer: audioBuffer,
            fileName: audioFileName,
            title: `Cognition Voice: ${audioFileName}`,
          },
          'imentiv'
        );

        imentivJobId = job.jobId;
        console.log(`[voice-transcript] Imentiv job submitted (jobId: ${job.jobId}). Polling for transcription...`);

        const pollStartTime = Date.now();
        const maxWaitMs = 5000;
        const pollIntervalMs = 1000;
        let imentivAnalysis: NormalizedAudioAnalysisResult | null = null;

        while (Date.now() - pollStartTime < maxWaitMs) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
          try {
            const statusResult = await audioAnalysisService.checkJobStatus(job.jobId, job.providerJobId);
            if (statusResult.status === 'COMPLETED' && statusResult.analysis) {
              imentivAnalysis = statusResult.analysis;
              break;
            }
            if (statusResult.status === 'FAILED') {
              console.warn('[voice-transcript] Imentiv processing returned FAILED status');
              break;
            }
          } catch (pollErr) {
            console.warn('[voice-transcript] Imentiv poll check warning:', pollErr);
          }
        }

        if (imentivAnalysis) {
          const rawTranscript = (imentivAnalysis as any).transcript;
          let transcriptText = '';
          if (typeof rawTranscript === 'string') {
            transcriptText = rawTranscript.trim();
          } else if (Array.isArray(rawTranscript)) {
            transcriptText = rawTranscript
              .map((t) => (typeof t === 'string' ? t : t?.text || t?.segment || t?.sentence || ''))
              .filter(Boolean)
              .join(' ')
              .trim();
          } else if (rawTranscript && typeof rawTranscript === 'object') {
            transcriptText = String(rawTranscript.text || rawTranscript.transcript || rawTranscript.summary || '').trim();
          }

          if (!transcriptText && Array.isArray(imentivAnalysis.segments)) {
            transcriptText = imentivAnalysis.segments
              .map((s) => s.text)
              .filter(Boolean)
              .join(' ')
              .trim();
          }

          if (transcriptText) {
            console.log(`[voice-transcript] Imentiv transcription completed: "${transcriptText.slice(0, 60)}..."`);
            return NextResponse.json({
              transcript: transcriptText,
              confidence: 0.95,
              sentiment: {
                overall: imentivAnalysis.sentiment.overall,
                score: imentivAnalysis.sentiment.score,
              },
              summary: imentivAnalysis.summary?.textSummary || '',
              topics: (imentivAnalysis.topics || []).map((t) => t.term),
              keywords: (imentivAnalysis.topicClusters || [])
                .flatMap((c) => c.terms.map((t) => t.term))
                .slice(0, 8),
              transcriptDetected: true,
              provider: 'imentiv',
              jobId: job.jobId,
            });
          }
        }

        console.warn(`[voice-transcript] Imentiv did not finish within ${maxWaitMs / 1000}s.`);
      } catch (imentivErr) {
        console.error('[voice-transcript] Error processing audio with Imentiv:', imentivErr);
      }
    }

    return NextResponse.json({
      transcript: 'Force could not detect spoken words clearly in this recording. Please try re-recording closer to the microphone.',
      confidence: 0,
      transcriptDetected: false,
      provider: 'fallback',
      jobId: imentivJobId,
    });
  } catch (error: any) {
    console.error('[voice-transcript] failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate transcript' },
      { status: 500 }
    );
  }
}
