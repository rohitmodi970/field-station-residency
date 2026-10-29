// apps/web/types/database.ts
// Complete TypeScript types for your Supabase database

// =====================================================
// ENUMS
// =====================================================

export type ThemeMode = 'light' | 'dark';
export type StorageScope = 'device_only' | 'cloud' | 'both';
export type StorageProvider = 'supabase' | 'google_drive' | 'both';
export type AccountType = 'private' | 'public';
export type MediaType = 'image' | 'audio' | 'video' | 'document';
export type UploadStatus = 'uploading' | 'completed' | 'failed';
export type NotificationType = 'info' | 'warning' | 'success' | 'error' | 'journal_reminder' | 'system';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms';
export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';
export type ProfileVisibility = 'public' | 'private' | 'community' | 'isolated';
export type AITaskType = 'summary' | 'sentiment' | 'topics' | 'keywords' | 'embedding';

// =====================================================
// DATABASE TABLES
// =====================================================

export interface User {
  id: string; // UUID
  created_at: string;
  updated_at: string;
  name: string | null;
  email: string;
  phone: string | null;
  username: string | null;
  is_active: boolean;
  onboarding_complete: boolean;
  profile_image: string | null;
  bio: string | null;
  last_login: string | null;
  last_login_ip: string | null;
  last_login_device: string | null;
}

export interface Journal {
  id: string; // UUID
  user_id: string; // UUID
  journal_id: string; // Custom ID
  post_id: string | null; // UUID
  title: string | null;
  content: string | null;
  journal_type: string | null;
  date: string; // Date as ISO string
  tags: string[];
  mood: string | null;
  location: string | null;
  weather: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  is_deleted: boolean;
  is_conflict_draft?: boolean;
  word_count: number;
  reading_time_minutes: number;
  analysis_count: number; // Number of times journal has been analyzed (max 1)
  is_analyzed: boolean;
  created_at: string;
  updated_at: string;
  display_date: string;
}

export interface JournalMedia {
  id: string; // UUID
  user_id: string; // UUID
  journal_id: string | null; // UUID
  post_id: string | null; // UUID
  media_type: MediaType;
  file_name: string;
  file_size: number | null;
  mime_type: string;
  storage_provider: StorageProvider;
  bucket: string | null;
  path: string | null;
  public_url: string | null;
  drive_file_id: string | null;
  drive_mime_type: string | null;
  width: number | null;
  height: number | null;
  duration: number | null; // in seconds
  thumbnail_url: string | null;
  upload_status: UploadStatus;
  processed: boolean;
  display_order: number;
  created_at: string;
}

export interface MessagingProviderConfig {
  enabled: boolean;
  botToken?: string | null;
  webhookSecret?: string | null;
  apiKey?: string | null;
  phoneNumber?: string | null;
  accountId?: string | null;
}

export interface MessagingIntegrations {
  telegram?: MessagingProviderConfig | null;
  whatsapp?: MessagingProviderConfig | null;
  imessage?: MessagingProviderConfig | null;
}

export interface UserSettings {
  user_id: string; // UUID
  theme_mode: ThemeMode;
  storage_scope: StorageScope;
  storage_provider: StorageProvider | null;
  account_type: AccountType;
  ai_features_enabled: boolean;
  messaging_integrations?: MessagingIntegrations | null;
  last_password_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  user_id: string; // UUID
  bio: string | null;
  personality_type: string | null;
  dob: string | null; // Date as ISO string
  languages: string[];
  social_media: Record<string, any> | null; // JSON
  sleeping_habits: string | null;
  interests: string[];
  photo_url: string | null;
  profile_visibility: ProfileVisibility;
  created_at: string;
  updated_at: string;
}

export interface UserMetrics {
  user_id: string; // UUID
  total_characters_written: number;
  total_time_spent_seconds: number;
  last_active: string;
  journal_count: number;
  average_entry_length: number;
  waitlist_signed_up: boolean;
  waitlist_signed_up_at: string | null;
  waitlist_access_granted: boolean;
  waitlist_access_granted_at: string | null;
  session_history: Record<string, any>[]; // JSON array
  created_at: string;
  updated_at: string;
}

export interface UserSession {
  id: string; // UUID
  user_id: string; // UUID
  session_token: string | null;
  created_at: string;
  expires_at: string | null;
  last_activity: string | null;
  ip_address: string; // inet
  user_agent: string | null;
  device_type: string | null;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
  is_active: boolean;
  logout_at: string | null;
}

export interface Notification {
  id: string; // UUID
  recipient_id: string; // UUID
  template_key: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any> | null; // JSON
  priority: NotificationPriority;
  channels: NotificationChannel[];
  status: DeliveryStatus;
  is_read: boolean;
  read_at: string | null;
  is_dismissed: boolean;
  dismissed_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplate {
  id: string; // UUID
  key: string;
  type: NotificationType;
  default_title: string;
  default_body: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationDelivery {
  id: string; // UUID
  notification_id: string; // UUID
  channel: NotificationChannel;
  provider: string | null;
  provider_msg_id: string | null;
  status: DeliveryStatus;
  error_message: string | null;
  attempted_at: string;
  delivered_at: string | null;
}

export interface UserNotificationSettings {
  user_id: string; // UUID
  in_app_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  muted_types: NotificationType[];
  quiet_start: string | null; // Time string (HH:MM)
  quiet_end: string | null; // Time string (HH:MM)
  time_zone: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIModel {
  id: string; // UUID
  provider: string;
  model_name: string;
  purpose: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AIInsight {
  id: string; // UUID
  user_id: string; // UUID
  journal_id: string | null; // UUID
  task_type: AITaskType;
  title: string | null;
  summary: string | null;
  sentiment_score: number | null;
  topics: string[] | null;
  keywords: string[] | null;
  embedding: number[] | null; // Vector
  confidence: number | null;
  model_id: string | null; // UUID
  input_chars: number | null;
  output_chars: number | null;
  meta: Record<string, any> | null; // JSON
  created_at: string;
}

export interface AIEvent {
  id: string; // UUID
  user_id: string | null; // UUID
  journal_id: string | null; // UUID
  model_id: string | null; // UUID
  task_type: AITaskType;
  status: string;
  latency_ms: number | null;
  input_chars: number | null;
  output_chars: number | null;
  error_message: string | null;
  created_at: string;
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

// Journal API
export interface CreateJournalRequest {
  title?: string;
  content?: string;
  journal_type?: string;
  tags?: string[];
  mood?: string;
  date?: string;
  location?: string;
  weather?: string;
  is_favorite?: boolean;
  is_archived?: boolean;
}

export interface UpdateJournalRequest {
  journal_id: string;
  title?: string;
  content?: string;
  journal_type?: string;
  tags?: string[];
  mood?: string;
  location?: string;
  weather?: string;
  is_favorite?: boolean;
  is_archived?: boolean;
}

export interface JournalResponse {
  journal: Journal & {
    journal_media?: JournalMedia[];
  };
}

export interface JournalsResponse {
  journals: (Journal & {
    journal_media?: Pick<JournalMedia, 'id' | 'media_type' | 'file_name' | 'thumbnail_url'>[];
  })[];
}

// Media API
export interface UploadMediaRequest {
  file: File;
  journal_id: string;
  media_type: MediaType;
  storage_provider?: StorageProvider;
}

export interface MediaResponse {
  message: string;
  media: JournalMedia & {
    signed_url?: string;
  };
}

export interface MediaListResponse {
  media: (JournalMedia & {
    signed_url?: string;
  })[];
}

// Settings API
export interface UpdateSettingsRequest {
  theme_mode?: ThemeMode;
  storage_scope?: StorageScope;
  storage_provider?: StorageProvider;
  account_type?: AccountType;
  ai_features_enabled?: boolean;
  messaging_integrations?: MessagingIntegrations | null;
}

export interface SettingsResponse {
  settings: UserSettings;
}

// Sync API
export interface SyncRequest {
  journals: Partial<Journal>[];
  deleted_journals: string[]; // journal_ids
}

export interface SyncResponse {
  sync_time: string;
  journals: Journal[];
  deleted_journals: string[]; // journal_ids
  settings: UserSettings | null;
  has_changes: boolean;
}

export interface SyncResultsResponse {
  message: string;
  sync_time: string;
  results: {
    synced: number;
    failed: number;
    errors: string[];
  };
}

export interface SyncStatsResponse {
  journal_count: number;
  total_media_size: number;
  media_by_type: Record<MediaType, number>;
  storage_provider: StorageProvider;
  storage_scope: StorageScope;
  last_sync: string;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface ApiError {
  error: string;
  details?: any;
}

export interface ApiSuccess<T = any> {
  message: string;
  data?: T;
}

// =====================================================
// FRONTEND-SPECIFIC TYPES
// =====================================================

export interface JournalWithMedia extends Journal {
  media?: JournalMedia[];
  media_count?: {
    image: number;
    audio: number;
    video: number;
    document: number;
  };
}

export interface MediaUploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'failed';
  error?: string;
  media?: JournalMedia;
}

export interface StorageUsage {
  total_size: number;
  total_size_mb: string;
  file_count: number;
  by_type: Record<MediaType, {
    size: number;
    size_mb: string;
    count: number;
  }>;
  limits: {
    total: number;
    remaining: number;
    percentage_used: number;
  };
}

export interface SessionInfo extends UserSession {
  is_current: boolean;
  location?: string;
  last_active_relative?: string;
}

export interface NotificationWithActions extends Notification {
  action_url?: string;
  action_label?: string;
  can_dismiss: boolean;
  icon?: string;
}

// =====================================================
// FILTER & SEARCH TYPES
// =====================================================

export interface JournalFilters {
  search?: string;
  tags?: string[];
  mood?: string;
  journal_type?: string;
  date_from?: string;
  date_to?: string;
  is_favorite?: boolean;
  is_archived?: boolean;
  has_media?: boolean;
  media_type?: MediaType;
}

export interface SortOptions {
  field: 'date' | 'created_at' | 'updated_at' | 'title' | 'word_count';
  order: 'asc' | 'desc';
}

// =====================================================
// FORM TYPES
// =====================================================

export interface JournalFormData {
  title: string;
  content: string;
  journal_type: string;
  tags: string[];
  mood: string;
  date: Date | string;
  is_favorite: boolean;
}

export interface ProfileFormData {
  name: string;
  bio: string;
  dob: string;
  languages: string[];
  interests: string[];
  personality_type: string;
  sleeping_habits: string;
}

export interface SettingsFormData {
  theme_mode: ThemeMode;
  storage_provider: StorageProvider;
  storage_scope: StorageScope;
  ai_features_enabled: boolean;
  notifications: {
    in_app: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

// =====================================================
// STATISTICS TYPES
// =====================================================

export interface JournalStats {
  total_journals: number;
  total_words: number;
  total_reading_time: number;
  average_entry_length: number;
  journals_this_month: number;
  journals_this_week: number;
  most_used_tags: Array<{ tag: string; count: number }>;
  mood_distribution: Record<string, number>;
  writing_streak: number;
  longest_streak: number;
}

export interface MediaStats {
  total_files: number;
  total_size: number;
  by_type: Record<MediaType, {
    count: number;
    size: number;
  }>;
  storage_provider_breakdown: Record<StorageProvider, {
    count: number;
    size: number;
  }>;
}

// =====================================================
// HOOK RETURN TYPES
// =====================================================

export interface UseJournalReturn {
  journal: Journal | null;
  loading: boolean;
  error: string | null;
  update: (updates: Partial<Journal>) => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseJournalsReturn {
  journals: Journal[];
  loading: boolean;
  error: string | null;
  create: (data: CreateJournalRequest) => Promise<Journal>;
  update: (journalId: string, updates: Partial<Journal>) => Promise<void>;
  remove: (journalId: string, permanent?: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseMediaReturn {
  media: JournalMedia[];
  loading: boolean;
  uploading: boolean;
  uploadProgress: number;
  error: string | null;
  upload: (file: File, mediaType: MediaType) => Promise<JournalMedia>;
  remove: (mediaId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseSettingsReturn {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  update: (updates: Partial<UserSettings>) => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseSyncReturn {
  isSyncing: boolean;
  lastSync: string | null;
  hasChanges: boolean;
  error: string | null;
  syncNow: () => Promise<void>;
  checkForUpdates: () => Promise<SyncResponse>;
}

// =====================================================
// CONTEXT TYPES
// =====================================================

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

export interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

export interface StorageContextType {
  provider: StorageProvider;
  scope: StorageScope;
  usage: StorageUsage | null;
  setProvider: (provider: StorageProvider) => Promise<void>;
  setScope: (scope: StorageScope) => Promise<void>;
  refreshUsage: () => Promise<void>;
}

// =====================================================
// EXPORT ALL
// =====================================================

export type Database = {
  public: {
    Tables: {
      users: User;
      journals: Journal;
      journal_media: JournalMedia;
      user_settings: UserSettings;
      user_profiles: UserProfile;
      user_metrics: UserMetrics;
      user_sessions: UserSession;
      notifications: Notification;
      notification_templates: NotificationTemplate;
      notification_deliveries: NotificationDelivery;
      user_notification_settings: UserNotificationSettings;
      ai_models: AIModel;
      ai_insights: AIInsight;
      ai_events: AIEvent;
    };
  };
};