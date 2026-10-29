// utils/audioAnalysisUtils.ts
import { JournalEntry } from '@/components/Journal/types';
import path from 'path';
import fs from 'fs';
import { analyzeMultiText } from '@/lib/analysis/client';

// Optional imports for ffmpeg (may not be available in production)
let ffmpeg: any;
let ffmpegPath: any;

try {
  ffmpeg = require('fluent-ffmpeg');
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  console.warn('FFmpeg not available. Audio splitting functionality will be disabled.');
}

// Function to extract audio entries from journal data
export function extractAudioEntries(entries: JournalEntry[]): JournalEntry[] {
  return entries.filter(entry => 
    entry.mediaType.includes('audio') && 
    entry.mediaUrl.audio && 
    entry.mediaUrl.audio.length > 0
  );
}

// Function to prepare audio entries for LLM analysis
export async function prepareAudioEntriesForAnalysis(
  entries: JournalEntry[]
): Promise<{ entriesWithTranscripts: JournalEntry[], audioUrls: string[] }> {
  const audioEntries = extractAudioEntries(entries);
  const audioUrls = audioEntries.flatMap(entry => entry.mediaUrl.audio || []);
  
  // For now, we'll just pass the audio URLs to the LLM
  // In a real application, you might want to transcribe the audio first
  
  return {
    entriesWithTranscripts: audioEntries,
    audioUrls
  };
}

// API call to analyze audio journal entries
export async function analyzeAudioJournal(
  entries: JournalEntry[],
  options: {
    timeframe?: 'day' | 'week' | 'month';
    analysisTypes?: string[];
  } = {}
): Promise<any> {
  try {
    const { entriesWithTranscripts, audioUrls } = await prepareAudioEntriesForAnalysis(entries);
    
    if (entriesWithTranscripts.length === 0) {
      return { error: 'No audio journal entries found' };
    }
    
    // We don't need to pass the actual audio files to Gemini API
    // Instead, we'll include the existence of audio in our prompt
    // so Gemini knows to incorporate that in its analysis
    
    return await analyzeMultiText({
      entries: entriesWithTranscripts,
      timeframe: options.timeframe || 'day',
      analysisTypes: options.analysisTypes || ['all'],
      analysisMode: 'audio',
      audioCount: audioUrls.length,
    });
  } catch (error) {
    console.error('Audio analysis error:', error);
    return { error: (error as Error).message };
  }
}

// Enhanced journal-analysis endpoint for audio (add this to your route.ts)
// This is a code suggestion for your journal-analysis API
/* 
// In app/api/journal-analysis/route.ts, add this to the POST function:

// Check if this is an audio analysis request
if (request.body?.analysisMode === 'audio') {
  // Modify the prompt for audio analysis
  prompt += `\nNOTE: These journal entries contain audio recordings. 
  There are ${request.body.audioCount} audio files mentioned.
  Please specifically analyze patterns in the user's voice journal entries,
  considering tone, emotion, and speaking patterns mentioned in the content.`;
}
*/

// Utility to split audio into segments
export async function splitAudioFile(
  inputPath: string,
  segmentDurationSec: number = 60,
  outputDir: string = path.dirname(inputPath)
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    // Check if ffmpeg is available
    if (!ffmpeg || !ffmpegPath) {
      reject(new Error('FFmpeg is not available. Audio splitting is disabled in this environment.'));
      return;
    }

    if (!fs.existsSync(ffmpegPath)) {
      // Try to resolve manually
      const localFfmpeg = path.resolve(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
      if (fs.existsSync(localFfmpeg)) {
        ffmpeg.setFfmpegPath(localFfmpeg);
      } else {
        reject(new Error('ffmpeg binary not found. Audio splitting is not available.'));
        return;
      }
    } else {
      ffmpeg.setFfmpegPath(ffmpegPath);
    }
    // Always output wav segments for Deepgram compatibility
    const base = path.basename(inputPath, path.extname(inputPath));
    const outputPattern = path.join(outputDir, `${base}_segment_%03d.wav`);

    ffmpeg(inputPath)
      .outputOptions([
        '-f', 'segment',
        '-segment_time', segmentDurationSec.toString(),
        '-c:a', 'pcm_s16le', // re-encode to wav
        '-ar', '16000',      // 16kHz sample rate (Deepgram recommended)
        '-ac', '1',          // mono channel (Deepgram recommended)
      ])
      .on('end', () => {
        const files = fs.readdirSync(outputDir)
          .filter((file: string) => file.startsWith(`${base}_segment_`) && file.endsWith('.wav'))
          .map((file: string) => path.join(outputDir, file));
        resolve(files);
      })
      .on('error', (err: unknown) => {
        reject(err);
      })
      .save(outputPattern);
  });
}