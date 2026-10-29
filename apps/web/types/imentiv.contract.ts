// apps/web/types/imentiv.contract.ts
// Complete type definitions for Imentiv Emotion Intelligence API (v1 / v2)

export type ImentivAudioStatus = 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface ImentivAudioUploadParams {
  title: string;
  audio_file?: File | Blob | Buffer;
  media_url?: string;
  callback_url?: string;
  description?: string;
  start_millis?: number;
  end_millis?: number;
  speaker_diarization?: boolean;
  text_emotion_analysis?: boolean;
  diarization?: boolean;
  text_emotion?: boolean;
  transcription?: boolean;
  language?: string;
  transcript?: string;
  transcript_format?: string;
  transcript_offset_millis?: number;
}


export interface ImentivAudioUploadResponse {
  id: string;
  title: string;
  status: string;
  duration?: number;
  media_source?: string;
  media_source_url?: string;
  media_source_type?: string;
  user_id?: string;
  created_at?: string;
}

export interface ImentivListAudiosParams {
  offset_audio_id?: string;
  page_size?: number;
  direction?: 'forward' | 'backward';
}

export interface ImentivListAudiosResponse {
  documents: Array<{
    id: string;
    title: string;
    status: string;
    created_at?: string;
    duration?: number;
  }> | null;
  count: number;
}

export interface ImentivEmotionScores {
  [emotionName: string]: number;
}

export interface ImentivAudioSegmentEmotion {
  start_millis?: number;
  end_millis?: number;
  speaker_id?: number | string;
  text?: string;
  emotions?: ImentivEmotionScores;
  [key: string]: unknown;
}

export interface ImentivTextSegmentEmotion {
  sentence?: string;
  start_millis?: number;
  end_millis?: number;
  emotions?: ImentivEmotionScores;
  [key: string]: unknown;
}

export interface ImentivSpeaker {
  speaker_id: number;
  name?: string;
  [key: string]: unknown;
}

export interface ImentivAudioDetailsResponse {
  id: string;
  status: string;
  created_at?: string | null;
  model_id?: string;
  url?: string;
  audio_duration?: number;
  task_completion_status?: number;
  user_id?: string;
  title?: string;
  average_audio_emotions?: ImentivEmotionScores;
  segment_audio_emotions?: ImentivAudioSegmentEmotion[];
  segment_text_emotions?: ImentivTextSegmentEmotion[];
  summary?: string;
  speakers?: ImentivSpeaker[];
  [key: string]: unknown;
}

export interface ImentivMultimodalSpeakerAnalytics {
  audio?: ImentivEmotionScores;
  text?: ImentivEmotionScores;
}

export interface ImentivMultimodalAnalyticsResponse {
  title?: string;
  status?: string;
  description?: string;
  created_at?: string;
  media_type?: string;
  audio_id?: string;
  text_id?: string;
  duration?: number;
  speaker_count?: number;
  media_source_url?: string;
  youtube_url?: string;
  detected_speakers?: Array<{
    name: string;
    speaker_id: number;
  }>;
  emotion_analysis?: {
    overall?: {
      audio?: ImentivEmotionScores;
      text?: ImentivEmotionScores;
    };
    speakers?: Record<string, ImentivMultimodalSpeakerAnalytics>;
  };
  [key: string]: unknown;
}

export interface ImentivTranscriptSegmentUpdate {
  start_millis: number;
  end_millis: number;
  segment: string;
  speaker_id: number;
}

export interface ImentivSpeakerUpdate {
  speaker_id: number;
  name: string;
}

export interface ImentivTextUploadParams {
  title?: string;
  text?: string;
  text_url?: string;
  text_file?: File | Blob | Buffer;
  callback_url?: string;
}

export interface ImentivTextUploadResponse {
  id: string;
  title?: string;
  status?: string;
  word_count?: number;
  user_id?: string;
  created_at?: string;
  media_source?: string;
  media_source_url?: string;
}

export interface ImentivTextSegment {
  sentence: string;
  emotions?: ImentivEmotionScores;
  [key: string]: unknown;
}

export interface ImentivTextDetailsResponse {
  id: string;
  status?: string;
  title?: string;
  model_id?: string;
  document_type?: string;
  user_id?: string;
  word_count?: number;
  text?: string;
  created_at?: string;
  emotions?: ImentivEmotionScores;
  segments?: ImentivTextSegment[];
  parent_id?: string;
  [key: string]: unknown;
}

export interface ImentivInsightsSendMessageParams {
  media_type: 'video' | 'audio' | 'image' | 'text';
  media_id: string;
  message: string;
  stream?: boolean;
}

export interface ImentivInsightsMessageResponse {
  conversation_id: string;
  message_id: number;
  response: string;
  token_usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  is_quota_exceeded?: boolean;
  credits_charged?: number;
}

export interface ImentivInsightsHistoryResponse {
  conversation_id: string;
  messages: Array<{
    role: 'user' | 'ai_assistant';
    text: string;
    message_id: number;
    timestamp: string;
  }>;
}

export interface ImentivWebhookNotification {
  audio_id?: string;
  text_id?: string;
  media_id?: string;
  status: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
  message?: string;
  error?: string;
  [key: string]: unknown;
}
