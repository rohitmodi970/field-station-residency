// apps/web/types/onboarding.ts

/**
 * Media file metadata stored in JSONB
 */
export interface MediaMetadata {
  storage_provider: 'supabase' | 'google_drive' ;
  bucket?: string;
  path?: string;
  public_url?: string;
  drive_file_id?: string;
  drive_mime_type?: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

/**
 * Audio-specific metadata
 */
export interface AudioMetadata extends MediaMetadata {
  duration?: number; // Duration in seconds
}

/**
 * Photo-specific metadata
 */
export interface PhotoMetadata extends MediaMetadata {
  width?: number;
  height?: number;
  thumbnail_url?: string;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms?: boolean;
}

/**
 * Onboarding step names (for skip tracking)
 */
export type OnboardingStepName = 
  | 'welcome'
  | 'goal'
  | 'audio'
  | 'photo'
  | 'preferences'
  | 'ai_features';

/**
 * Writing time preferences
 */
export type WritingTime = 'morning' | 'afternoon' | 'evening' | 'night' | 'anytime';

/**
 * Device types
 */
export type DeviceType = 'desktop' | 'mobile' | 'tablet';

/**
 * Platform types
 */
export type Platform = 'web' | 'ios' | 'android';

/**
 * Referral sources
 */
export type ReferralSource = 
  | 'organic'
  | 'social'
  | 'friend'
  | 'email'
  | 'advertisement'
  | 'other';

/**
 * Journal types user can prefer
 */
export type JournalType = 
  | 'daily'
  | 'gratitude'
  | 'dream'
  | 'travel'
  | 'fitness'
  | 'work'
  | 'personal';

/**
 * Main onboarding data structure
 */
export interface UserOnboarding {
  // Primary Key
  id: string;
  
  // User Reference
  user_id: string;
  
  // Progress Tracking
  step_completed: number; // 0-5
  total_steps: number; // Usually 5
  
  // Step 1: Goal Setting
  goal?: string;
  preferred_journal_types?: JournalType[];
  
  // Step 2: Audio Introduction
  feeling_audio?: AudioMetadata;
  feeling_audio_transcription?: string;
  feeling_audio_sentiment?: number; // -1.00 to 1.00
  
  // Step 3: Photo Upload
  pretty_photo?: PhotoMetadata;
  
  // Step 4: Preferences
  preferred_writing_time?: WritingTime;
  reminder_enabled?: boolean;
  reminder_time?: string; // Format: "HH:MM:SS"
  notification_preferences?: NotificationPreferences;
  
  // Step 5: AI Features
  ai_features_accepted?: boolean;
  ai_sentiment_analysis?: boolean;
  ai_topic_detection?: boolean;
  ai_writing_suggestions?: boolean;
  
  // Additional Profile Info
  interests?: string[];
  personality_traits?: string[];
  mood_tracking_enabled?: boolean;
  
  // Completion Tracking
  completed: boolean;
  started_at: string; // ISO timestamp
  completed_at?: string; // ISO timestamp
  
  // Time Tracking
  time_spent_seconds?: number;
  
  // Skip Tracking
  skipped_steps?: OnboardingStepName[];
  
  // Device Info
  device_type?: DeviceType;
  platform?: Platform;
  
  // Metadata
  version?: string; // Default: "1.0"
  referral_source?: ReferralSource;
  
  // Timestamps
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Onboarding progress data from RPC function
 */
export interface OnboardingProgress {
  step_completed: number;
  total_steps: number;
  progress_percentage: number; // 0-100
  is_completed: boolean;
  time_spent_minutes: number;
}

/**
 * Partial type for creating onboarding
 */
export type CreateOnboardingData = Pick<
  UserOnboarding,
  'referral_source' | 'device_type' | 'platform'
>;

/**
 * Partial type for updating onboarding steps
 */
export type UpdateOnboardingStepData = Partial<
  Pick<
    UserOnboarding,
    | 'step_completed'
    | 'goal'
    | 'preferred_journal_types'
    | 'feeling_audio'
    | 'feeling_audio_transcription'
    | 'feeling_audio_sentiment'
    | 'pretty_photo'
    | 'preferred_writing_time'
    | 'reminder_enabled'
    | 'reminder_time'
    | 'notification_preferences'
    | 'ai_features_accepted'
    | 'ai_sentiment_analysis'
    | 'ai_topic_detection'
    | 'ai_writing_suggestions'
    | 'interests'
    | 'personality_traits'
    | 'mood_tracking_enabled'
    | 'time_spent_seconds'
    | 'skipped_steps'
  >
>;

/**
 * Response type for onboarding API calls
 */
export interface OnboardingResponse<T = UserOnboarding> {
  data: T | null;
  error: {
    message: string;
    code?: string;
  } | null;
}

/**
 * Response type for success/failure operations
 */
export interface OnboardingActionResponse {
  success: boolean;
  data?: UserOnboarding | null;
  error?: {
    message: string;
    code?: string;
  } | null;
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  data: AudioMetadata | PhotoMetadata | null;
  error: {
    message: string;
    code?: string;
  } | null;
}

/**
 * Onboarding step configuration
 */
export interface OnboardingStep {
  step: number;
  name: OnboardingStepName;
  title: string;
  description: string;
  isOptional: boolean;
  estimatedMinutes: number;
}

/**
 * Complete onboarding configuration
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    step: 0,
    name: 'welcome',
    title: 'Welcome to Journal App',
    description: 'Get started with your journaling journey',
    isOptional: false,
    estimatedMinutes: 1,
  },
  {
    step: 1,
    name: 'goal',
    title: 'Set Your Goal',
    description: 'Tell us what you want to achieve',
    isOptional: false,
    estimatedMinutes: 2,
  },
  {
    step: 2,
    name: 'audio',
    title: 'Share Your Feelings',
    description: 'Record a short audio message',
    isOptional: true,
    estimatedMinutes: 3,
  },
  {
    step: 3,
    name: 'photo',
    title: 'Add a Photo',
    description: 'Upload a photo that represents you',
    isOptional: true,
    estimatedMinutes: 2,
  },
  {
    step: 4,
    name: 'preferences',
    title: 'Set Preferences',
    description: 'Customize your journaling experience',
    isOptional: false,
    estimatedMinutes: 2,
  },
  {
    step: 5,
    name: 'ai_features',
    title: 'AI Features',
    description: 'Enable AI-powered insights',
    isOptional: true,
    estimatedMinutes: 1,
  },
];

/**
 * Helper type guards
 */
export const isAudioMetadata = (
  media: MediaMetadata | undefined
): media is AudioMetadata => {
  return media !== undefined && 'duration' in media;
};

export const isPhotoMetadata = (
  media: MediaMetadata | undefined
): media is PhotoMetadata => {
  return media !== undefined && ('width' in media || 'height' in media);
};

/**
 * Validation helpers
 */
export const validateStep = (step: number, totalSteps: number = 5): boolean => {
  return step >= 0 && step <= totalSteps;
};

export const validateSentiment = (score: number | undefined): boolean => {
  if (score === undefined) return true;
  return score >= -1 && score <= 1;
};

/**
 * Enum for storage providers (alternative to union types)
 */
export enum StorageProvider {
  SUPABASE = 'supabase',
  GOOGLE_DRIVE = 'google_drive',
}

/**
 * Enum for writing times
 */
export enum WritingTimeEnum {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
  EVENING = 'evening',
  NIGHT = 'night',
  ANYTIME = 'anytime',
}

/**
 * Props for onboarding components
 */
export interface OnboardingStepProps {
  currentStep: number;
  onboardingData: UserOnboarding | null;
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  onUpdate: (data: UpdateOnboardingStepData) => Promise<void>;
}

/**
 * Context type for onboarding
 */
export interface OnboardingContextType {
  onboarding: UserOnboarding | null;
  progress: OnboardingProgress | null;
  isLoading: boolean;
  error: string | null;
  startOnboarding: (data?: CreateOnboardingData) => Promise<void>;
  updateStep: (data: UpdateOnboardingStepData) => Promise<void>;
  nextStep: () => Promise<void>;
  previousStep: () => Promise<void>;
  skipStep: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  uploadAudio: (file: File) => Promise<AudioMetadata | null>;
  uploadPhoto: (file: File) => Promise<PhotoMetadata | null>;
  refresh: () => Promise<void>;
}

/**
 * Form data types for each step
 */
export interface GoalStepData {
  goal: string;
  preferred_journal_types: JournalType[];
}

export interface AudioStepData {
  feeling_audio?: AudioMetadata;
  feeling_audio_transcription?: string;
}

export interface PhotoStepData {
  pretty_photo?: PhotoMetadata;
}

export interface PreferencesStepData {
  preferred_writing_time: WritingTime;
  reminder_enabled: boolean;
  reminder_time?: string;
  notification_preferences: NotificationPreferences;
}

export interface AIFeaturesStepData {
  ai_features_accepted: boolean;
  ai_sentiment_analysis: boolean;
  ai_topic_detection: boolean;
  ai_writing_suggestions: boolean;
}

/**
 * Combined form data type
 */
export type OnboardingFormData = 
  | GoalStepData
  | AudioStepData
  | PhotoStepData
  | PreferencesStepData
  | AIFeaturesStepData;

/**
 * Constants
 */
export const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Default values
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: false,
  push: false,
  sms: false,
};

export const DEFAULT_ONBOARDING: Partial<UserOnboarding> = {
  step_completed: 0,
  total_steps: 5,
  completed: false,
  mood_tracking_enabled: true,
  ai_sentiment_analysis: true,
  ai_topic_detection: true,
  ai_writing_suggestions: false,
  reminder_enabled: false,
  version: '1.0',
};

/**
 * Type for database insert (omit auto-generated fields)
 */
export type InsertUserOnboarding = Omit<
  UserOnboarding,
  'id' | 'created_at' | 'updated_at'
>;

/**
 * Type for database update (all fields optional except id)
 */
export type UpdateUserOnboarding = Partial<Omit<UserOnboarding, 'id'>> & {
  id: string;
};