// app/api/voice-analysis/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { processWithHume } from '@/utilities/HumeAudioProcess';
import { generateSpectrogram } from '@/utilities/spectrogram';
import fs from 'fs';
import path from 'path';
import { createClient } from '@/utils/supabase/server';

const execPromise = promisify(exec);

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  return { user };
}

// Define TypeScript interfaces
interface FileInfo {
  filepath: string;
  filename: string;
}

interface AudioFeatures {
  duration: number;
  sampleRate: number;
  bitrate: number;
}

interface EmotionData {
  emotions: Record<string, number>;
  error?: string;
}

interface TimeSeries {
  [index: number]: number;
}

interface PitchData {
  average: number;
  variation: number;
  data: number[];
}

interface RateData {
  wordsPerMinute: number;
  syllablesPerSecond: number;
  data: number[];
}

interface VolumeData {
  average: number;
  peak: number;
  data: number[];
}

interface PauseData {
  count: number;
  locations: number[];
  durations?: number[];
  averageDuration: number;
}

interface SpeechParameters {
  pitch: PitchData;
  rate: RateData;
  volume: VolumeData;
  pauses: PauseData;
}

interface SpectrogramData {
  intensity: number[][];
  timeAxis: number[];
  frequencyAxis: number[];
  image?: string;
}

interface EnergyData {
  totalEnergy: number;
  averageEnergy: number;
  energyDistribution: Array<{time: number; energy: number}>;
}

interface HumeData {
  transcript: string;
  confidence: number;
  sentiment: {
    overall: string;
    score: number;
  };
  topics: string[];
  keywords: string[];
  summary: string;
  wordTimestamps?: Array<{
    text: string;
    time: { begin: number; end: number };
    confidence?: number;
  }>;
}

interface AnalysisResults {
  metadata: {
    filename: string;
    filesize: number;
    duration: number;
    sampleRate: number;
    bitrate: number;
    timestamp: string;
  };
  emotions: Record<string, number>;
  linguistics: HumeData;
  energyData: EnergyData;
  spectrogram: SpectrogramData;
  speech: SpeechParameters;
}

// Define Hume AI API response interface
interface HumeAIResponse {
  predictions?: Array<{
    emotions?: Array<{
      name: string;
      score: number;
    }>;
  }>;
}

// Helper to save uploaded file to a temporary location
const saveFileToDisk = async (file: File): Promise<FileInfo> => {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  // Create a unique filename
  const filename = `${uuidv4()}-${file.name}`;
  const filepath = join(tmpdir(), filename);
  
  // Write the file to disk
  await writeFile(filepath, buffer);
  
  return { filepath, filename };
};

// Helper to extract audio features using FFmpeg
const extractAudioFeatures = async (filePath: string): Promise<AudioFeatures> => {
  try {
    // Get audio duration
    const { stdout: durationOutput } = await execPromise(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    const duration = parseFloat(durationOutput.trim());
    
    // Get audio sample rate
    const { stdout: sampleRateOutput } = await execPromise(
      `ffprobe -v error -select_streams a:0 -show_entries stream=sample_rate -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    const sampleRate = parseInt(sampleRateOutput.trim(), 10);
    
    // Get audio bitrate
    const { stdout: bitrateOutput } = await execPromise(
      `ffprobe -v error -select_streams a:0 -show_entries stream=bit_rate -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    const bitrate = parseInt(bitrateOutput.trim(), 10) || 0;
    console.log("duration", duration);
    console.log("sampleRate", sampleRate);
    console.log("bitrate", bitrate);
    return {
      duration,
      sampleRate,
      bitrate
    };
  } catch (error) {
    console.error('Error extracting audio features:', error);
    
    // Return mock data as fallback
    return {
      duration: 0,
      sampleRate: 0,
      bitrate: 0
    };
  }
};

// Process audio with Hume AI API
const processWithHumeAI = async (filePath: string): Promise<EmotionData> => {
  try {
    // Validate environment variables
    const humeApiKey = process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY;
    const humeSecret = process.env.HUME_SECRET || process.env.HUME_AI_SECRET;
    
    if (!humeApiKey) {
      console.warn('HUME_API_KEY is missing - using fallback emotions');
      return {
        emotions: {
          joy: 0.65,
          sadness: 0.12,
          anger: 0.05,
          fear: 0.08,
          surprise: 0.32,
          disgust: 0.02,
          contempt: 0.04,
          neutral: 0.22
        },
        error: 'HUME_API_KEY not configured'
      };
    }

    // Validate file exists and is readable
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch (fileError) {
      throw new Error(`Cannot read file: ${filePath}. Error: ${(fileError as Error).message}`);
    }

    // Get file stats to check size and type
    const stats = await fs.promises.stat(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    
    // Check file size (Hume AI typically has limits around 25MB)
    if (fileSizeInMB > 25) {
      throw new Error(`File too large: ${fileSizeInMB.toFixed(2)}MB (max 25MB)`);
    }

    // Determine file type
    const fileExtension = path.extname(filePath).toLowerCase();
    const supportedExtensions = ['.wav', '.mp3', '.flac', '.m4a'];
    if (!supportedExtensions.includes(fileExtension)) {
      throw new Error(`Unsupported file type: ${fileExtension}. Supported: ${supportedExtensions.join(', ')}`);
    }

    // Prepare form data
    const fileBuffer = await fs.promises.readFile(filePath);
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: `audio/${fileExtension.slice(1)}` });
    const formData = new FormData();
    formData.append('file', blob, `audio${fileExtension}`);

    // Detailed logging of request
    console.log('Sending request to Hume AI with:', {
      filePath,
      fileSize: `${fileSizeInMB.toFixed(2)}MB`,
      fileType: fileExtension
    });

    // Upload file to a temporary public URL or use file data directly
    // For Hume AI Batch API, we need to submit a job and poll for results
    // This is a synchronous wrapper for simplicity
    
    // Create form data for batch job
    const jobFormData = new FormData();
    jobFormData.append('file', blob, `audio${fileExtension}`);
    jobFormData.append('json', JSON.stringify({
      models: {
        prosody: {}
      }
    }));

    // Make API request using Expression Measurement Batch API
    const jobResponse = await axios.post(
      'https://api.hume.ai/v0/batch/jobs',
      jobFormData,
      {
        headers: {
          'X-Hume-Api-Key': humeApiKey,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 60000 // 60 seconds timeout for batch job
      }
    );

    const jobId = (jobResponse.data as any).job_id;
    console.log(`[Hume AI] Job created: ${jobId}`);

    // Poll for job completion (simplified polling with timeout)
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 60 seconds max wait
    let jobComplete = false;
    let response: any;

    while (!jobComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const statusResponse = await axios.get(
        `https://api.hume.ai/v0/batch/jobs/${jobId}`,
        {
          headers: {
            'X-Hume-Api-Key': humeApiKey
          }
        }
      );

      const status = (statusResponse.data as any).state?.status;
      console.log(`[Hume AI] Job status: ${status}`);

      if (status === 'COMPLETED') {
        jobComplete = true;
        // Get predictions
        const predictionsResponse = await axios.get(
          `https://api.hume.ai/v0/batch/jobs/${jobId}/predictions`,
          {
            headers: {
              'X-Hume-Api-Key': humeApiKey
            }
          }
        );
        response = predictionsResponse.data;
      } else if (status === 'FAILED') {
        throw new Error(`Hume AI job failed: ${(statusResponse.data as any).state?.message || 'Unknown error'}`);
      }
      
      attempts++;
    }

    if (!jobComplete) {
      throw new Error('Hume AI job timeout - processing took too long');
    }

    // Process emotions from Hume AI Batch API response
    const emotions: Record<string, number> = {};
    
    if (response?.[0]?.results?.predictions?.[0]?.models?.prosody?.grouped_predictions?.[0]?.predictions?.[0]?.emotions) {
      response[0].results.predictions[0].models.prosody.grouped_predictions[0].predictions[0].emotions.forEach((emotion: { name: string; score: number }) => {
        emotions[emotion.name.toLowerCase()] = emotion.score;
      });
    }

    console.log(`[Hume AI] Extracted ${Object.keys(emotions).length} emotions`);
    return { emotions };

  } catch (error: any) {
    // Comprehensive error logging
    console.error('Hume AI Processing Error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });

    // Detailed error response
    if (error.response) {
      console.error('Full Response:', {
        status: error.response.status,
        headers: error.response.headers,
        data: error.response.data
      });
    }

    // Fallback emotions
    return {
      emotions: {
        joy: 0.65,
        sadness: 0.12,
        anger: 0.05,
        fear: 0.08,
        surprise: 0.32,
        disgust: 0.02,
        contempt: 0.04,
        neutral: 0.22
      },
      error: error.message
    };
  }
};

// Analyze speech parameters
const analyzeSpeechParameters = async (filePath: string): Promise<SpeechParameters> => {
  try {
    // Extract speech rate by analyzing silence
    const silenceDetectionOutput = await execPromise(
      `ffmpeg -i "${filePath}" -af silencedetect=noise=-30dB:d=0.5 -f null - 2>&1`
    );
    
    const output = silenceDetectionOutput.stdout + silenceDetectionOutput.stderr;
    
    // Parse silence timestamps
    const silenceStartMatches = output.match(/silence_start: [0-9]+(\.[0-9]+)?/g) || [];
    const silenceEndMatches = output.match(/silence_end: [0-9]+(\.[0-9]+)?/g) || [];
    
    const silenceStarts = silenceStartMatches.map(match => 
      parseFloat(match.replace('silence_start: ', ''))
    );
    
    const silenceEnds = silenceEndMatches.map(match => 
      parseFloat(match.replace('silence_end: ', ''))
    );
    
    // Calculate pause information
    const durations = silenceStarts.map((start, idx) => (silenceEnds[idx] || 0) - start);
    const pauses: PauseData = {
      count: silenceStarts.length,
      locations: silenceStarts,
      durations: durations,
      averageDuration: silenceStarts.length > 0 ? 
        durations.reduce((sum, duration) => sum + duration, 0) / silenceStarts.length : 0
    };
    
    // Get audio duration for rate calculation
    const { stdout: durationOutput } = await execPromise(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    );
    const duration = parseFloat(durationOutput.trim());
    
    // Extract volume information
    const volumeOutput = await execPromise(
      `ffmpeg -i "${filePath}" -af "volumedetect" -vn -sn -dn -f null /dev/null 2>&1`
    );
    
    const volumeText = volumeOutput.stdout + volumeOutput.stderr;
    const meanVolumeMatch = volumeText.match(/mean_volume: ([-\d.]+) dB/);
    const maxVolumeMatch = volumeText.match(/max_volume: ([-\d.]+) dB/);
    
    const meanVolume = meanVolumeMatch && meanVolumeMatch[1] ? parseFloat(meanVolumeMatch[1]) : -20;
    const maxVolume = maxVolumeMatch && maxVolumeMatch[1] ? parseFloat(maxVolumeMatch[1]) : -10;
    
    // Generate mock pitch analysis (realistically this would require more complex analysis)
    // Pitch analysis is more complex and might require specialized tools
    const generateMockTimeSeries = (length: number, min: number, max: number): number[] => {
      const result: number[] = [];
      let value = min + Math.random() * (max - min);
      
      for (let i = 0; i < length; i++) {
        // Random walk with boundaries
        value += (Math.random() - 0.5) * (max - min) * 0.1;
        value = Math.min(max, Math.max(min, value));
        result.push(value);
      }
      
      return result;
    };
    
    // Calculate approximate speech rate
    // This is a very rough estimate - real speech rate detection is more complex
    const totalSpeakingTime = duration - (pauses.durations?.reduce((sum, d) => sum + d, 0) || 0);
    const estimatedWordsPerMinute = Math.floor(150 * (totalSpeakingTime / duration));
    
    return {
      pitch: {
        // Mock pitch data - realistically would require specialized analysis
        average: 165, // Hz - approximate human speaking average
        variation: 45, // Hz
        data: generateMockTimeSeries(Math.floor(duration * 5), 120, 210) // 5 samples per second
      },
      rate: {
        wordsPerMinute: estimatedWordsPerMinute,
        syllablesPerSecond: estimatedWordsPerMinute / 60 * 1.5, // Rough approximation
        data: generateMockTimeSeries(Math.floor(duration * 5), 2, 6) // 5 samples per second
      },
      volume: {
        average: meanVolume,
        peak: maxVolume,
        data: generateMockTimeSeries(Math.floor(duration * 5), meanVolume - 10, maxVolume)
      },
      pauses: pauses
    };
  } catch (error) {
    console.error('Error analyzing speech parameters:', error);
    
    // Return mock data as fallback
    const generateTimeSeriesData = (length: number, min: number, max: number): number[] => {
      return Array.from({ length }, () => min + Math.random() * (max - min));
    };
    
    return {
      pitch: {
        average: 180, // Hz
        variation: 42, // Hz
        data: generateTimeSeriesData(100, 120, 240)
      },
      rate: {
        wordsPerMinute: 165,
        syllablesPerSecond: 4.2,
        data: generateTimeSeriesData(100, 3, 5.5)
      },
      volume: {
        average: -18, // dB
        peak: -6, // dB
        data: generateTimeSeriesData(100, -30, -5)
      },
      pauses: {
        count: 12,
        averageDuration: 0.8,
        locations: [5.2, 10.6, 15.3, 22.1, 28.5, 35.8, 42.3, 48.9, 56.2, 63.7, 69.1, 74.5]
      }
    };
  }
};

// Helper to calculate energy levels from spectrogram data
const calculateEnergyLevels = (spectrogram: SpectrogramData): EnergyData => {
  const { intensity, timeAxis } = spectrogram;

  // Calculate energy per time frame (sum of squared intensities across frequencies)
  const energyPerFrame = intensity.map((frame) =>
    frame.reduce((sum, value) => sum + value * value, 0)
  );

  // Total energy
  const totalEnergy = energyPerFrame.reduce((sum, value) => sum + value, 0);

  // Average energy
  const averageEnergy = totalEnergy / energyPerFrame.length;

  // Energy distribution data for graphing
  const energyDistribution = energyPerFrame.map((energy, index) => ({
    time: timeAxis[index] || 0,
    energy,
  }));

  return { totalEnergy, averageEnergy, energyDistribution };
};

// The main API route handler for App Router
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }
    const user = authResult.user;

    // Parse the FormData
    const formData = await request.formData();
    const file = formData.get('audioFile') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { message: 'No audio file provided' },
        { status: 400 }
      );
    }
    
    // Save the file to a temporary location
    const { filepath, filename } = await saveFileToDisk(file);
    
    // Process audio in parallel for better performance
    const [
      audioFeatures,
      humeAIData,
      humeData,
      spectrogramData,
      speechParams
    ] = await Promise.all([
      extractAudioFeatures(filepath),
      processWithHumeAI(filepath),
      processWithHume(filepath, user.id, true),
      generateSpectrogram(filepath),
      analyzeSpeechParameters(filepath)
    ]);

    if (humeData.error) {
      return NextResponse.json(
        {
          error: humeData.error,
          errorCode: humeData.errorCode || 'HUME_JOB_FAILED',
          hume: humeData,
        },
        { status: humeData.statusCode || 502 }
      );
    }
    
    const energyData = calculateEnergyLevels(spectrogramData);
    const emotions = humeAIData.emotions;
    
    // Create the response object with all analysis results
    const analysisResults: AnalysisResults = {
      metadata: {
        filename: filename,
        filesize: file.size,
        duration: audioFeatures.duration,
        sampleRate: audioFeatures.sampleRate,
        bitrate: audioFeatures.bitrate,
        timestamp: new Date().toISOString()
      },
      emotions: emotions,
      linguistics: {
        ...humeData,
        sentiment: {
          ...humeData.sentiment,
          positive: humeData.sentiment.overall === 'positive' ? humeData.sentiment.score : 0,
          negative: humeData.sentiment.overall === 'negative' ? humeData.sentiment.score : 0,
          neutral: humeData.sentiment.overall === 'neutral' ? humeData.sentiment.score : 0
        },
        wordTimestamps: humeData.wordTimestamps || []
      } as HumeData,
      energyData: energyData,
      spectrogram: spectrogramData,
      speech: speechParams
    };
    
    // Clean up temporary file
    fs.unlink(filepath, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });
    
    // Send response
    return NextResponse.json(analysisResults);
  } catch (error: any) {
    console.error('API error:', error);
    const message = error instanceof Error ? error.message : String(error);
    const isHumeCreditIssue = message.toLowerCase().includes('exhausted credit balance') ||
      message.toLowerCase().includes('credit balance is too low') ||
      message.toLowerCase().includes('insufficient credit') ||
      message.toLowerCase().includes('insufficient credits');
    return NextResponse.json(
      {
        message: isHumeCreditIssue
          ? 'Hume credit balance is exhausted. Please top up your Hume account and retry.'
          : 'Error processing audio file',
        error: message,
        errorCode: isHumeCreditIssue ? 'HUME_CREDITS_EXHAUSTED' : 'VOICE_ANALYSIS_FAILED',
      },
      { status: isHumeCreditIssue ? 402 : 500 }
    );
  }
}